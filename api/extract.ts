import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createGmailClient,
  openGmailAllMail,
  buildGmailQuery,
} from '../src/server/imap.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { email, appPassword, category, limit = 20, customQuery, dateFilter } = req.body || {};

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
      const selectedUids =
        sortOrder === 'oldest'
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
}
