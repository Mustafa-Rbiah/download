export interface GmailCredentials {
  email: string;
  appPassword: string;
}

export interface AuthSession {
  email: string;
  isConnected: boolean;
  mailboxCount?: number;
}

const STORAGE_KEY = 'gmail_imap_credentials';

/**
 * Loads saved credentials from localStorage
 */
export function getStoredCredentials(): GmailCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === 'string' && typeof parsed.appPassword === 'string') {
      return {
        email: parsed.email.trim(),
        appPassword: parsed.appPassword.replace(/\s+/g, '').trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves credentials to localStorage
 */
export function saveStoredCredentials(creds: GmailCredentials): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        email: creds.email.trim(),
        appPassword: creds.appPassword.replace(/\s+/g, '').trim(),
      })
    );
  } catch (err) {
    console.warn('Could not save credentials to localStorage:', err);
  }
}

/**
 * Clears stored credentials
 */
export function clearStoredCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Verifies credentials against the IMAP server via POST /api/verify
 */
export async function verifyCredentials(
  email: string,
  appPassword: string
): Promise<{ success: boolean; mailboxCount?: number; error?: string }> {
  const cleanEmail = email.trim();
  const cleanPass = appPassword.replace(/\s+/g, '').trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Please enter both your Gmail address and 16-character App Password.');
  }

  const response = await fetch('/api/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: cleanEmail,
      appPassword: cleanPass,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(
      data.error ||
        'Failed to connect to imap.gmail.com:993. Please check your Gmail address and App Password.'
    );
  }

  return {
    success: true,
    mailboxCount: data.mailboxCount,
  };
}

export async function logout(): Promise<void> {
  clearStoredCredentials();
}
