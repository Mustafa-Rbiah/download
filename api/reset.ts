import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createGmailClient,
  openGmailAllMail,
  removeDownloadedLabel,
} from '../src/server/imap.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { email, appPassword } = req.body || {};

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
}
