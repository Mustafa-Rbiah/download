import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createGmailClient } from '../src/server/imap.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { email, appPassword } = req.body || {};

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
}
