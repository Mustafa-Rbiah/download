import { EmailItem, EmailCategory, EMAIL_CATEGORIES, DiscoveredCategory } from '../types.js';

/**
 * Resilient fetch helper for Gmail API with automatic exponential backoff retry
 * Handles HTTP 429 (Too Many Requests) and HTTP 403 (User rate limit / Quota exceeded)
 */
export async function gmailFetch(
  url: string,
  options: RequestInit = {},
  retries = 4,
  baseDelay = 1200
): Promise<Response> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, options);

      // Check if response hit Gmail rate or quota limits
      if (response.status === 429 || (response.status === 403 && attempt < retries)) {
        let isQuotaError = response.status === 429;
        let errorMessage = '';

        if (!isQuotaError) {
          try {
            const cloned = response.clone();
            const errJson = await cloned.json();
            errorMessage = errJson?.error?.message || '';
            const reason = errJson?.error?.errors?.[0]?.reason || '';
            if (
              errorMessage.toLowerCase().includes('quota') ||
              errorMessage.toLowerCase().includes('rate') ||
              reason === 'rateLimitExceeded' ||
              reason === 'userRateLimitExceeded' ||
              reason === 'quotaExceeded'
            ) {
              isQuotaError = true;
            }
          } catch {
            // Ignore clone parsing error
          }
        }

        if (isQuotaError && attempt < retries) {
          attempt++;
          // Look for Retry-After header or use exponential backoff + jitter
          const retryAfterHeader = response.headers.get('Retry-After');
          const delayMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);

          console.warn(`[Gmail API] Rate limit / Quota hit. Backing off for ${delayMs}ms (attempt ${attempt}/${retries})...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }

      return response;
    } catch (networkErr: any) {
      if (attempt < retries) {
        attempt++;
        const delayMs = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 300);
        console.warn(`[Gmail API] Network error: ${networkErr.message}. Retrying in ${delayMs}ms (attempt ${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw networkErr;
    }
  }
}

/**
 * Convert base64url string (RFC 4648 §5) to standard raw bytes
 */
export function base64UrlToUint8Array(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Build the query string for any selected category and optional date/time range
 * Explicitly enforces -label:Downloaded and is:unread
 */
export function buildQuery(
  category: EmailCategory | string,
  customQuery?: string,
  startDate?: string,
  endDate?: string
): string {
  let baseQuery = '';
  if (category === 'custom') {
    baseQuery = (customQuery && customQuery.trim()) ? customQuery.trim() : 'is:unread';
  } else if (category === 'primary' || category === 'cat_primary') {
    // Primary: category:primary is:unread -label:Downloaded
    baseQuery = 'category:primary is:unread -label:Downloaded';
  } else if (category === 'promotions' || category === 'cat_promotions') {
    // Promotions: category:promotions is:unread -label:Downloaded
    baseQuery = 'category:promotions is:unread -label:Downloaded';
  } else {
    const match = EMAIL_CATEGORIES.find((c) => c.id === category);
    if (match?.query) {
      baseQuery = `${match.query} -label:Downloaded`;
    } else if (category.startsWith('category:') || category.startsWith('label:')) {
      baseQuery = `${category} is:unread -label:Downloaded`;
    } else {
      baseQuery = `category:${category} is:unread -label:Downloaded`;
    }
  }

  // Ensure -label:Downloaded is present if not already in custom query
  if (!baseQuery.includes('-label:Downloaded')) {
    baseQuery = `${baseQuery} -label:Downloaded`;
  }

  const dateParts: string[] = [];
  if (startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) {
      const epochSeconds = Math.floor(d.getTime() / 1000);
      dateParts.push(`after:${epochSeconds}`);
    }
  }
  if (endDate) {
    const d = new Date(endDate);
    if (!isNaN(d.getTime())) {
      const epochSeconds = Math.floor(d.getTime() / 1000);
      dateParts.push(`before:${epochSeconds}`);
    }
  }

  if (dateParts.length > 0) {
    return `${baseQuery} ${dateParts.join(' ')}`;
  }
  return baseQuery;
}

/**
 * Query unread messages for any selected category or custom query
 */
export async function searchUnreadMessages(
  category: EmailCategory | string,
  maxResults: number,
  accessToken: string,
  customQuery?: string,
  startDate?: string,
  endDate?: string
): Promise<{ id: string; threadId?: string }[]> {
  const query = buildQuery(category, customQuery, startDate, endDate);
  const targetCount = Math.min(Math.max(1, maxResults), 300);
  const allMessages: { id: string; threadId?: string }[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('q', query);
    const fetchBatchSize = Math.min(targetCount - allMessages.length, 100);
    url.searchParams.set('maxResults', fetchBatchSize.toString());
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await gmailFetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData?.error?.message || `Gmail API error: ${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    const data = await response.json();
    const batch = (data.messages || []) as { id: string; threadId?: string }[];
    allMessages.push(...batch);
    pageToken = data.nextPageToken;
  } while (pageToken && allMessages.length < targetCount);

  return allMessages.slice(0, targetCount);
}

/**
 * Concurrency worker pool for running async tasks with rate pacing
 */
export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  iteratorFn: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number, result?: R) => void
): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let completed = 0;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      const item = items[idx];
      const res = await iteratorFn(item, idx);
      ret[idx] = res;
      completed++;
      if (onProgress) {
        onProgress(completed, items.length, res);
      }
      // Brief rate-pacing yield
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  const pool = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(pool);
  return ret;
}

/**
 * Fetch message metadata only (Subject, From, Date, Snippet) for fast extraction view without marking as read
 */
export async function fetchMessageMetadata(
  messageId: string,
  accessToken: string
): Promise<{ subject: string; from: string; date: string; snippet: string; sizeEstimate: number }> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&fields=id,threadId,snippet,sizeEstimate,payload(headers(name,value))`;
  const response = await gmailFetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch message ${messageId} metadata`);
  }

  const data = await response.json();
  let subject = '(No Subject)';
  let from = '(Unknown Sender)';
  let date = new Date().toISOString();

  if (data.payload?.headers) {
    for (const h of data.payload.headers) {
      if (h.name.toLowerCase() === 'subject') subject = h.value;
      if (h.name.toLowerCase() === 'from') from = h.value;
      if (h.name.toLowerCase() === 'date') date = h.value;
    }
  }

  return {
    subject,
    from,
    date,
    snippet: data.snippet || '',
    sizeEstimate: data.sizeEstimate || 1024,
  };
}

/**
 * Fetch raw message content and parse basic metadata (Subject, From, Date)
 */
export async function fetchRawMessage(
  messageId: string,
  accessToken: string
): Promise<{
  rawBytes: Uint8Array;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  messageId?: string;
}> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=raw&fields=id,threadId,snippet,raw`;
  const response = await gmailFetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch message ${messageId}`);
  }

  const data = await response.json();
  const rawBase64 = data.raw;
  if (!rawBase64) {
    throw new Error(`Message ${messageId} does not contain raw data`);
  }

  const rawBytes = base64UrlToUint8Array(rawBase64);

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const headerSlice = rawBytes.subarray(0, Math.min(rawBytes.length, 8192));
  const headerText = decoder.decode(headerSlice);

  const subject = extractHeader(headerText, 'Subject') || '(No Subject)';
  const from = extractHeader(headerText, 'From') || '(Unknown Sender)';
  const date = extractHeader(headerText, 'Date') || new Date().toISOString();
  const rfcMessageId = extractHeader(headerText, 'Message-ID') || undefined;
  const snippet = data.snippet || '';

  return {
    rawBytes,
    subject,
    from,
    date,
    snippet,
    messageId: rfcMessageId,
  };
}

/**
 * Discover labels and categories that actually exist on the user's Gmail account
 */
let cachedDiscoveredCategories: DiscoveredCategory[] | null = null;
let lastDiscoveryTime = 0;

export async function discoverAccountLabels(accessToken: string, force = false): Promise<DiscoveredCategory[]> {
  const now = Date.now();
  if (!force && cachedDiscoveredCategories && now - lastDiscoveryTime < 45000) {
    return cachedDiscoveredCategories;
  }

  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/labels';
  const response = await gmailFetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return cachedDiscoveredCategories || [];
  }

  const data = await response.json();
  const rawLabels: Array<{ id: string; name: string; type: string }> = data.labels || [];

  // Filter to core categories and inbox to avoid excessive quota consumption
  const targetLabelIds = new Set([
    'INBOX',
    'CATEGORY_PERSONAL',
    'CATEGORY_PROMOTIONS',
    'CATEGORY_SOCIAL',
    'CATEGORY_UPDATES',
    'CATEGORY_FORUMS',
    'SPAM',
  ]);

  const labelsToFetch = rawLabels.filter((l) => targetLabelIds.has(l.id) || l.type === 'user');

  // Fetch in controlled small concurrency
  const details = await Promise.allSettled(
    labelsToFetch.slice(0, 15).map(async (l) => {
      const res = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${encodeURIComponent(l.id)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) return null;
      return res.json();
    })
  );

  const categories: DiscoveredCategory[] = [];

  for (const item of details) {
    if (item.status !== 'fulfilled' || !item.value) continue;
    const l = item.value;
    const total = l.messagesTotal ?? 0;
    const unread = l.messagesUnread ?? 0;
    const id = l.id;
    const name = l.name || id;

    if (
      id === 'DRAFT' ||
      id === 'SENT' ||
      id === 'TRASH' ||
      id === 'CHAT' ||
      id === 'UNREAD' ||
      id === 'STARRED' ||
      id === 'IMPORTANT' ||
      id === 'SPAM'
    ) {
      continue;
    }

    if (total === 0 && id !== 'INBOX') {
      continue;
    }

    if (id === 'INBOX') {
      categories.push({
        id: 'inbox',
        label: 'Primary Inbox',
        query: 'label:inbox',
        description: 'All messages in your Inbox',
        unreadCount: unread,
        totalCount: total,
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      });
    } else if (id === 'CATEGORY_PERSONAL') {
      categories.push({
        id: 'cat_primary',
        label: 'Primary',
        query: 'category:primary',
        description: 'Personal, direct, and essential correspondence',
        unreadCount: unread,
        totalCount: total,
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      });
    } else if (id === 'CATEGORY_PROMOTIONS') {
      categories.push({
        id: 'cat_promotions',
        label: 'Promotions',
        query: 'category:promotions',
        description: 'Marketing offers, newsletters, and discounts',
        unreadCount: unread,
        totalCount: total,
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      });
    } else if (id === 'CATEGORY_SOCIAL') {
      categories.push({
        id: 'cat_social',
        label: 'Social',
        query: 'category:social',
        description: 'Notifications from social media and platforms',
        unreadCount: unread,
        totalCount: total,
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      });
    } else if (id === 'CATEGORY_UPDATES') {
      categories.push({
        id: 'cat_updates',
        label: 'Updates',
        query: 'category:updates',
        description: 'Automated confirmations, bills, and alerts',
        unreadCount: unread,
        totalCount: total,
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      });
    } else if (id === 'CATEGORY_FORUMS') {
      categories.push({
        id: 'cat_forums',
        label: 'Forums',
        query: 'category:forums',
        description: 'Online discussion groups and mailing lists',
        unreadCount: unread,
        totalCount: total,
        badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      });
    } else if (l.type === 'user') {
      categories.push({
        id: l.id,
        label: `Folder: ${name}`,
        query: `label:"${name}"`,
        description: `Custom account label: ${name}`,
        unreadCount: unread,
        totalCount: total,
        badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      });
    }
  }

  cachedDiscoveredCategories = categories;
  lastDiscoveryTime = Date.now();
  return categories;
}

/**
 * Parse headers with unfolded multi-line support
 */
function extractHeader(headerBlock: string, headerName: string): string | null {
  const regex = new RegExp(`^${headerName}:\\s*(.+?)(?=\\r?\\n[\\S]|$)`, 'im');
  const match = headerBlock.match(regex);
  if (match && match[1]) {
    return match[1].replace(/\r?\n\s+/g, ' ').trim();
  }
  return null;
}

/**
 * Remove UNREAD label to ensure deduplication across runs
 */
export async function markMessageAsRead(
  messageId: string,
  accessToken: string
): Promise<boolean> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`;
  const response = await gmailFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      removeLabelIds: ['UNREAD'],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to mark message ${messageId} as read`);
  }

  return true;
}

/**
 * Get or create the 'Downloaded' label in user's Gmail account (OAuth mode)
 */
let cachedDownloadedLabelId: string | null = null;

export async function getOrCreateDownloadedLabelId(accessToken: string): Promise<string> {
  if (cachedDownloadedLabelId) return cachedDownloadedLabelId;

  // 1. List labels to see if Downloaded already exists
  const listRes = await gmailFetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (listRes.ok) {
    const data = await listRes.json();
    const existing = (data.labels || []).find(
      (l: any) => l.name && l.name.toLowerCase() === 'downloaded'
    );
    if (existing && existing.id) {
      cachedDownloadedLabelId = existing.id;
      return existing.id;
    }
  }

  // 2. Create Downloaded label
  const createRes = await gmailFetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      name: 'Downloaded',
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  });

  if (createRes.ok) {
    const created = await createRes.json();
    cachedDownloadedLabelId = created.id;
    return created.id;
  }

  // Fallback to label name string
  return 'Downloaded';
}

/**
 * Attach 'Downloaded' label to email in Gmail without touching UNREAD flag or Inbox
 */
export async function attachDownloadedLabel(
  messageId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const labelId = await getOrCreateDownloadedLabelId(accessToken);
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`;
    const response = await gmailFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: [labelId],
        removeLabelIds: [], // DO NOT remove UNREAD! Keep bold and unread in Inbox!
      }),
    });
    return response.ok;
  } catch (err) {
    console.warn(`Could not attach Downloaded label to ${messageId}:`, err);
    return false;
  }
}

/**
 * Fast batch attach 'Downloaded' label to multiple messages at once using batchModify
 */
export async function batchAttachDownloadedLabels(
  messageIds: string[],
  accessToken: string
): Promise<boolean> {
  if (!messageIds || messageIds.length === 0) return true;
  try {
    const labelId = await getOrCreateDownloadedLabelId(accessToken);
    // Chunk in 500s if needed
    for (let i = 0; i < messageIds.length; i += 500) {
      const chunk = messageIds.slice(i, i + 500);
      const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify';
      await gmailFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          ids: chunk,
          addLabelIds: [labelId],
          removeLabelIds: [], // Strictly DO NOT remove UNREAD!
        }),
      });
    }
    return true;
  } catch (err) {
    console.warn('Batch attach label warning:', err);
    return false;
  }
}

/**
 * Remove 'Downloaded' label from all tagged emails on Gmail by deleting the label
 * or untagging messages directly via the Gmail REST API (100% browser client-side).
 */
export async function removeDownloadedLabelFromAll(
  accessToken: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ count: number }> {
  let count = 0;

  try {
    // 1. Find Downloaded label ID
    const listRes = await gmailFetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (listRes.ok) {
      const data = await listRes.json();
      const existing = (data.labels || []).find(
        (l: any) => l.name && l.name.toLowerCase() === 'downloaded'
      );

      if (existing && existing.id) {
        // Query how many messages currently have this label to report count
        const countRes = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/labels/${encodeURIComponent(existing.id)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          }
        );
        if (countRes.ok) {
          const labelInfo = await countRes.json();
          count = labelInfo.messagesTotal || 0;
        }

        // Delete the Downloaded label directly (untags all messages instantaneously)
        const delRes = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/labels/${encodeURIComponent(existing.id)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        cachedDownloadedLabelId = null;

        if (delRes.ok) {
          if (onProgress) onProgress(count, count);
          return { count };
        }
      }
    }
  } catch (err) {
    console.warn('Direct label deletion fallback to message untagging:', err);
  }

  // Fallback: iterate over messages with label:Downloaded and remove labelId
  try {
    const labelId = await getOrCreateDownloadedLabelId(accessToken);
    const query = 'label:Downloaded';
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '500');

    const res = await gmailFetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) return { count: 0 };

    const data = await res.json();
    const messages: Array<{ id: string }> = data.messages || [];
    count = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      try {
        await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(msg.id)}/modify`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            removeLabelIds: [labelId],
          }),
        });
        count++;
        if (onProgress) onProgress(count, messages.length);
      } catch (_) {}
    }
  } catch (e) {
    console.error('Error during fallback untagging:', e);
  }

  return { count };
}

/**
 * Sanitize filename for .eml export
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim().substring(0, 80);
}
