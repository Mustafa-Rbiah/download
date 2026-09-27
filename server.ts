import express, { Request, Response } from 'express';
import path from 'path';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import {
  createGmailClient,
  openGmailAllMail,
  ensureDownloadedLabel,
  addDownloadedLabel,
  removeDownloadedLabel,
  buildGmailQuery,
} from './src/server/imap.js';
import { cleanAndFormatEmlBytes } from './src/services/headerCleaner.js';
import { CleanHeadersConfig } from './src/types.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Helper to sanitize filenames for .eml files inside the zip
 */
function sanitizeFilename(subject: string, id: string): string {
  const cleanSubject = (subject || 'untitled')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim()
    .slice(0, 60);
  return `${cleanSubject}_${id}.eml`;
}

// ==========================================
// 1. POST /api/verify - Test IMAP Credentials
// ==========================================
app.post('/api/verify', async (req: Request, res: Response) => {
  const { email, appPassword } = req.body;

  if (!email || !appPassword) {
    return res.status(400).json({
      success: false,
      error: 'Gmail Address and 16-character App Password are required.',
    });
  }

  const client = createGmailClient({ email, appPassword });

  try {
    await client.connect();
    const mailboxes = await client.list();
    await client.logout();

    return res.json({
      success: true,
      email: email.trim(),
      mailboxCount: mailboxes.length,
    });
  } catch (err: any) {
    console.error('IMAP Verification error:', err);
    let errorMessage = err.message || 'Authentication failed.';

    if (
      errorMessage.toLowerCase().includes('authenticationfailed') ||
      errorMessage.toLowerCase().includes('invalid credentials') ||
      errorMessage.toLowerCase().includes('login failed')
    ) {
      errorMessage =
        'Invalid Gmail address or App Password. Please generate a 16-character App Password at https://myaccount.google.com/apppasswords and make sure 2-Step Verification is enabled.';
    }

    return res.status(401).json({
      success: false,
      error: errorMessage,
    });
  }
});

// ==============================================================
// 2. POST /api/extract - Fast Preview & Metadata without ZIP
// ==============================================================
app.post('/api/extract', async (req: Request, res: Response) => {
  const { email, appPassword, category, limit = 20, customQuery, dateFilter } = req.body;

  if (!email || !appPassword) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  const client = createGmailClient({ email, appPassword });

  try {
    await client.connect();
    const { lock } = await openGmailAllMail(client);

    try {
      const query = buildGmailQuery(category || 'inbox', customQuery, dateFilter);
      const searchResult = await client.search({ gmraw: query }, { uid: true });
      const uids = Array.isArray(searchResult) ? (searchResult as number[]) : [];

      if (uids.length === 0) {
        return res.json({
          success: true,
          totalFound: 0,
          items: [],
          query,
        });
      }

      const countToFetch = Math.min(Number(limit) || 20, uids.length);
      const sortOrder = dateFilter?.sortOrder || 'newest';
      let selectedUids = sortOrder === 'oldest'
        ? uids.slice(0, countToFetch)
        : uids.slice(-countToFetch).reverse();

      const items: any[] = [];

      for await (const message of client.fetch(
        selectedUids,
        {
          uid: true,
          envelope: true,
          internalDate: true,
          size: true,
          flags: true,
          labels: true,
        },
        { uid: true }
      )) {
        const env = message.envelope || ({} as any);
        const fromStr = env.from?.[0]
          ? `${env.from[0].name ? `"${env.from[0].name}" ` : ''}<${env.from[0].address || ''}>`
          : 'Unknown';

        items.push({
          id: String(message.uid),
          messageId: env.messageId || `<${message.uid}@gmail.com>`,
          subject: env.subject || '(No Subject)',
          from: fromStr,
          date: message.internalDate ? new Date(message.internalDate).toISOString() : '',
          sizeEstimate: message.size || 0,
          status: 'extracted',
        });
      }

      return res.json({
        success: true,
        totalFound: uids.length,
        items,
        query,
      });
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err: any) {
    console.error('Extract error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to extract emails.',
    });
  }
});

// =========================================================================
// 3. POST /api/download - Download Raw .EML, Clean Headers, Zip & Stream
// =========================================================================
app.post('/api/download', async (req: Request, res: Response) => {
  const {
    email,
    appPassword,
    category,
    limit = 20,
    headerOptions = {},
    customQuery,
    dateFilter,
  } = req.body;

  if (!email || !appPassword) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  const client = createGmailClient({ email, appPassword });

  try {
    await client.connect();
    await ensureDownloadedLabel(client);

    const { lock } = await openGmailAllMail(client);

    try {
      const query = buildGmailQuery(category || 'inbox', customQuery, dateFilter);
      const searchResult = await client.search({ gmraw: query }, { uid: true });
      const uids = Array.isArray(searchResult) ? (searchResult as number[]) : [];

      if (uids.length === 0) {
        return res.status(404).json({
          success: false,
          error: `No unread, non-downloaded emails found matching query "${query}".`,
        });
      }

      const countToFetch = Math.min(Number(limit) || 20, uids.length);
      const sortOrder = dateFilter?.sortOrder || 'newest';
      let selectedUids = sortOrder === 'oldest'
        ? uids.slice(0, countToFetch)
        : uids.slice(-countToFetch).reverse();

      const processedItems: {
        id: string;
        subject: string;
        from: string;
        date: string;
        filename: string;
        size: number;
        bytes: Uint8Array;
      }[] = [];

      const fetchedUids: number[] = [];

      for await (const message of client.fetch(
        selectedUids,
        {
          uid: true,
          envelope: true,
          internalDate: true,
          size: true,
          source: true,
        },
        { uid: true }
      )) {
        if (!message.source) continue;

        fetchedUids.push(message.uid);

        const env = message.envelope || ({} as any);
        const fromStr = env.from?.[0]
          ? `${env.from[0].name ? `"${env.from[0].name}" ` : ''}<${env.from[0].address || ''}>`
          : 'Unknown';
        const subject = env.subject || '(No Subject)';
        const dateStr = message.internalDate
          ? new Date(message.internalDate).toISOString()
          : new Date().toISOString();

        const rawBytes = new Uint8Array(message.source);
        const finalBytes = headerOptions.enabled !== false
          ? cleanAndFormatEmlBytes(rawBytes, headerOptions as CleanHeadersConfig)
          : rawBytes;

        const filename = sanitizeFilename(subject, String(message.uid));

        processedItems.push({
          id: String(message.uid),
          subject,
          from: fromStr,
          date: dateStr,
          filename,
          size: finalBytes.length,
          bytes: finalBytes,
        });
      }

      if (processedItems.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch raw message contents from IMAP server.',
        });
      }

      // Tag all fetched emails with the 'Downloaded' label on Gmail
      try {
        await addDownloadedLabel(client, fetchedUids);
      } catch (labelErr) {
        console.warn('Could not add label Downloaded via addDownloadedLabel:', labelErr);
      }

      const acceptHeader = req.headers['accept'] || '';
      const wantsJson = req.query.format === 'json' || acceptHeader.includes('application/json');

      if (wantsJson) {
        return res.json({
          success: true,
          total: processedItems.length,
          items: processedItems.map((item) => ({
            id: item.id,
            subject: item.subject,
            from: item.from,
            date: item.date,
            filename: item.filename,
            sizeEstimate: item.size,
            status: 'completed',
            rawBase64: Buffer.from(item.bytes).toString('base64'),
          })),
        });
      }

      const catSlug = (category || 'mail').replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const zipFilename = `gmail_backup_${catSlug}_${timestamp}.zip`;

      const zip = new JSZip();
      for (const item of processedItems) {
        zip.file(item.filename, item.bytes);
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.setHeader('X-Total-Count', String(processedItems.length));

      return res.status(200).send(zipBuffer);
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err: any) {
    console.error('Download error:', err);
    try {
      await client.logout();
    } catch (_) {}
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to download and package emails.',
      });
    }
  }
});

// =========================================================================
// 4. POST /api/reset - Remove 'Downloaded' Label from All Emails
// =========================================================================
app.post('/api/reset', async (req: Request, res: Response) => {
  const { email, appPassword } = req.body;

  if (!email || !appPassword) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  const client = createGmailClient({ email, appPassword });

  try {
    await client.connect();
    const { lock } = await openGmailAllMail(client);

    try {
      const searchResult = await client.search({ gmraw: 'label:Downloaded' }, { uid: true });
      const uids = Array.isArray(searchResult) ? (searchResult as number[]) : [];

      const result = await removeDownloadedLabel(client, uids);
      const totalRemoved = uids.length > 0 ? uids.length : result.count;

      return res.json({
        success: true,
        count: totalRemoved,
        message: totalRemoved > 0
          ? `Successfully removed "Downloaded" label from ${totalRemoved} email(s).`
          : 'No emails were tagged with "Downloaded" label.',
      });
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err: any) {
    console.error('Reset error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to remove "Downloaded" labels on Gmail.',
    });
  }
});

// Vite middleware for development & static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IMAP Gmail Downloader Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
