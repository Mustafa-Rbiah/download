export interface EmailItem {
  id: string;
  threadId?: string;
  messageId?: string;
  subject: string;
  from: string;
  date: string;
  snippet?: string;
  sizeEstimate?: number;
  emlBlob?: Blob;
  status: 'pending' | 'fetching' | 'decoding' | 'marking_read' | 'completed' | 'error' | 'extracted';
  error?: string;
  rawBase64?: string;
  isAlreadyDownloaded?: boolean;
}

export type EmailCategory =
  | 'all'
  | 'primary'
  | 'promotions'
  | 'social'
  | 'updates'
  | 'forums'
  | 'inbox'
  | 'custom'
  | string;

export interface DiscoveredCategory {
  id: string;
  label: string;
  mailbox?: string;
  rawQuery?: string;
  query?: string;
  description: string;
  unreadCount: number;
  totalCount: number;
  badgeColor?: string;
}

export interface CategoryOption {
  id: EmailCategory;
  label: string;
  query: string;
  description: string;
  badgeColor: string;
}

export const EMAIL_CATEGORIES: CategoryOption[] = [
  {
    id: 'inbox',
    label: 'Primary Inbox (label:inbox)',
    query: 'label:inbox is:unread',
    description: 'Any unread message present in the inbox regardless of category tab.',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    id: 'primary',
    label: 'Primary (category:primary)',
    query: 'category:primary is:unread',
    description: 'Personal, direct, and essential correspondence.',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'promotions',
    label: 'Promotions (category:promotions)',
    query: 'category:promotions is:unread',
    description: 'Marketing offers, newsletters, and promotional discounts.',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'social',
    label: 'Social (category:social)',
    query: 'category:social is:unread',
    description: 'Notifications from social networks, messaging, and media platforms.',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    id: 'updates',
    label: 'Updates (category:updates)',
    query: 'category:updates is:unread',
    description: 'Automated confirmations, bills, receipts, and system alerts.',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'forums',
    label: 'Forums (category:forums)',
    query: 'category:forums is:unread',
    description: 'Messages from online discussion groups, boards, and mailing lists.',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  {
    id: 'all',
    label: 'All Mail (Any Category)',
    query: 'is:unread',
    description: 'All unread incoming mail across all categories and tabs.',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  {
    id: 'custom',
    label: 'Custom Gmail Search Query',
    query: '',
    description: 'Specify any custom Gmail search operators (e.g., from:amazon is:unread).',
    badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
  },
];

export interface BatchProgress {
  total: number;
  current: number;
  phase: 'idle' | 'searching' | 'processing' | 'zipping' | 'resetting' | 'completed' | 'error';
  statusText: string;
}

export interface DownloadStats {
  totalFetched: number;
  totalBytes: number;
  lastRunAt: string | null;
}

export type SortOrder = 'newest' | 'oldest';

export type DateFilterPreset = 'all' | 'today' | '7days' | '30days' | 'custom';

export interface DateFilterConfig {
  preset: DateFilterPreset;
  startDate?: string;
  endDate?: string;
  sortOrder: SortOrder;
}

export interface CleanHeadersConfig {
  enabled: boolean;
  // From formatting
  fromEnabled: boolean;
  fromDomainReplacement: string;
  fromTemplate?: string;
  // To formatting
  toEnabled: boolean;
  toTemplate: string;
  // Cc formatting
  ccEnabled: boolean;
  ccTemplate: string;
  ccAlwaysPresent: boolean;
  // Date formatting
  dateEnabled: boolean;
  dateTemplate: string;
  // Subject formatting
  subjectEnabled: boolean;
  subjectPrefix: string;
  // Message-ID formatting
  messageIdEnabled: boolean;
  messageIdTag: string;
  // Structural options
  trimBeforeReturnPath?: boolean;
  removeSpfAuthHeaders?: boolean;
}

export const DEFAULT_CLEAN_HEADERS_CONFIG: CleanHeadersConfig = {
  enabled: true,
  fromEnabled: true,
  fromDomainReplacement: '[RDNS]',
  fromTemplate: '[RDNS]',
  toEnabled: true,
  toTemplate: '[*to]',
  ccEnabled: true,
  ccTemplate: '[*to]',
  ccAlwaysPresent: true,
  dateEnabled: true,
  dateTemplate: '[DATE]',
  subjectEnabled: false,
  subjectPrefix: 'RE: ',
  messageIdEnabled: true,
  messageIdTag: '[EID]',
  trimBeforeReturnPath: true,
  removeSpfAuthHeaders: true,
};
