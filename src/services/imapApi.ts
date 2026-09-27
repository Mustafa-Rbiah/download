import { EmailItem, EmailCategory, DateFilterConfig, CleanHeadersConfig } from '../types.js';

export interface ExtractResponse {
  success: boolean;
  totalFound: number;
  items: EmailItem[];
  query?: string;
  error?: string;
}

export interface ResetResponse {
  success: boolean;
  count: number;
  message?: string;
  error?: string;
}

/**
 * Extracts email metadata via IMAP backend without downloading full bodies or marking as read
 */
export async function extractEmailsViaBackend(
  email: string,
  appPassword: string,
  category: EmailCategory,
  limit: number,
  customQuery?: string,
  dateFilter?: DateFilterConfig
): Promise<ExtractResponse> {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim(),
      appPassword: appPassword.replace(/\s+/g, '').trim(),
      category,
      limit,
      customQuery,
      dateFilter,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to extract email previews via IMAP server.');
  }

  return data;
}

/**
 * Downloads raw .eml emails via IMAP backend, cleans headers, packages into ZIP,
 * and initiates browser download. Returns metadata for the activity log and stats.
 */
export async function downloadEmailsViaBackend(
  email: string,
  appPassword: string,
  category: EmailCategory,
  limit: number,
  headerOptions: CleanHeadersConfig,
  customQuery?: string,
  dateFilter?: DateFilterConfig
): Promise<{ blob: Blob; filename: string; totalSize: number; totalCount: number }> {
  const response = await fetch('/api/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/zip',
    },
    body: JSON.stringify({
      email: email.trim(),
      appPassword: appPassword.replace(/\s+/g, '').trim(),
      category,
      limit,
      headerOptions,
      customQuery,
      dateFilter,
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to download emails from IMAP server.';
    try {
      const text = await response.text();
      try {
        const errJson = JSON.parse(text);
        errorMessage = errJson.error || errJson.message || errorMessage;
      } catch {
        if (text && text.length < 200 && !text.includes('<!DOCTYPE')) {
          errorMessage = text;
        } else {
          errorMessage = `Server returned HTTP ${response.status} (${response.statusText || 'Internal Error'})`;
        }
      }
    } catch {
      errorMessage = `Server returned HTTP ${response.status} (${response.statusText || 'Internal Error'})`;
    }
    throw new Error(errorMessage);
  }

  // Extract filename from Content-Disposition header if available
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  let filename = 'gmail_backup_emails.zip';
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
  if (filenameMatch && filenameMatch[1]) {
    filename = filenameMatch[1];
  }

  const countHeader = response.headers.get('X-Total-Count');
  const totalCount = countHeader ? parseInt(countHeader, 10) : limit;

  const blob = await response.blob();

  // Trigger immediate browser download
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  return {
    blob,
    filename,
    totalSize: blob.size,
    totalCount,
  };
}

/**
 * Removes the 'Downloaded' label from all tagged emails via IMAP backend
 */
export async function resetDownloadedTagsViaBackend(
  email: string,
  appPassword: string
): Promise<ResetResponse> {
  const response = await fetch('/api/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim(),
      appPassword: appPassword.replace(/\s+/g, '').trim(),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to reset tags on IMAP server.');
  }

  return data;
}
