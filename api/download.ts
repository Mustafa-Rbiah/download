import type { VercelRequest, VercelResponse } from '@vercel/node';
import JSZip from 'jszip';
import {
  createGmailClient,
  openGmailAllMail,
  ensureDownloadedLabel,
  addDownloadedLabel,
  buildGmailQuery,
} from '../src/server/imap.js';
import { cleanAndFormatEmlBytes } from '../src/services/headerCleaner.js';
import { CleanHeadersConfig } from '../src/types.js';

function sanitizeFilename(subject: string, id: string): string {
  const cleanSubject = (subject || 'untitled')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim()
    .slice(0, 60);
  return `${cleanSubject}_${id}.eml`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const {
    email,
    appPassword,
    category,
    limit = 20,
    headerOptions = {},
    customQuery,
    dateFilter,
  } = req.body || {};

  if (!email || !appPassword) {
    return res.status(400).json({ success: false, error: 'Missing Gmail address or App Password.' });
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
      const selectedUids = sortOrder === 'oldest'
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

      const acceptHeader = (req.headers && req.headers['accept']) || '';
      const wantsJson = req.query?.format === 'json' || acceptHeader.includes('application/json');

      if (wantsJson) {
        return res.status(200).json({
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
      const zipFilename = `gmail_Download_${catSlug}_${timestamp}.zip`;

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
}
