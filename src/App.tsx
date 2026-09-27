import React, { useState, useEffect } from 'react';
import {
  GmailCredentials,
  getStoredCredentials,
  saveStoredCredentials,
  clearStoredCredentials,
  verifyCredentials,
} from './services/auth';
import {
  extractEmailsViaBackend,
  downloadEmailsViaBackend,
  resetDownloadedTagsViaBackend,
} from './services/imapApi';
import {
  EmailItem,
  EmailCategory,
  DiscoveredCategory,
  BatchProgress,
  DownloadStats,
  EMAIL_CATEGORIES,
  DateFilterConfig,
  CleanHeadersConfig,
  DEFAULT_CLEAN_HEADERS_CONFIG,
} from './types';
import { AuthBar } from './components/AuthBar';
import { Controls } from './components/Controls';
import { ProgressBar } from './components/ProgressBar';
import { ActivityTable } from './components/ActivityTable';
import { EmlPreviewModal } from './components/EmlPreviewModal';
import {
  FileArchive,
  Download,
  AlertTriangle,
} from 'lucide-react';

export default function App() {
  // Credentials & Auth state
  const [credentials, setCredentials] = useState<GmailCredentials | null>(() => getStoredCredentials());
  const [isConnected, setIsConnected] = useState<boolean>(() => !!getStoredCredentials());
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Controls state
  const [category, setCategory] = useState<EmailCategory>('primary');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [downloadCount, setDownloadCount] = useState<number>(20);
  const [dateFilter, setDateFilter] = useState<DateFilterConfig>({
    preset: 'all',
    sortOrder: 'newest',
  });

  const [cleanHeadersConfig, setCleanHeadersConfig] = useState<CleanHeadersConfig>(() => {
    try {
      const saved = localStorage.getItem('gmail_clean_headers_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CLEAN_HEADERS_CONFIG,
          ...parsed,
          fromDomainReplacement:
            parsed.fromDomainReplacement ??
            (parsed.fromTemplate?.includes('@')
              ? (parsed.fromTemplate.match(/@([^>]+)>/)?.[1] || '[RDNS]')
              : (parsed.fromTemplate || '[RDNS]')),
        };
      }
      return DEFAULT_CLEAN_HEADERS_CONFIG;
    } catch {
      return DEFAULT_CLEAN_HEADERS_CONFIG;
    }
  });

  const handleCleanHeadersConfigChange = (updated: CleanHeadersConfig) => {
    setCleanHeadersConfig(updated);
    try {
      localStorage.setItem('gmail_clean_headers_config', JSON.stringify(updated));
    } catch {}
  };

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isResettingTags, setIsResettingTags] = useState<boolean>(false);

  // Batch progress & activity data
  const [progress, setProgress] = useState<BatchProgress>({
    total: 0,
    current: 0,
    phase: 'idle',
    statusText: '',
  });
  const [activityLogs, setActivityLogs] = useState<EmailItem[]>([]);
  const [lastExport, setLastExport] = useState<{
    blob: Blob;
    filename: string;
    totalSize: number;
    totalFiles: number;
  } | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Preview modal
  const [previewEmail, setPreviewEmail] = useState<EmailItem | null>(null);

  // Aggregate Stats
  const [stats, setStats] = useState<DownloadStats>({
    totalFetched: 0,
    totalBytes: 0,
    lastRunAt: null,
  });

  // Verify stored credentials on startup if available
  useEffect(() => {
    const saved = getStoredCredentials();
    if (saved?.email && saved?.appPassword) {
      verifyCredentials(saved.email, saved.appPassword)
        .then(() => {
          setIsConnected(true);
        })
        .catch((err) => {
          console.warn('Auto-verify of stored credentials failed:', err);
          setIsConnected(false);
        });
    }
  }, []);

  const handleConnect = async (creds: GmailCredentials) => {
    setIsAuthenticating(true);
    setAuthError(null);
    setErrorBanner(null);

    try {
      await verifyCredentials(creds.email, creds.appPassword);
      saveStoredCredentials(creds);
      setCredentials(creds);
      setIsConnected(true);
      setProgress({
        total: 100,
        current: 100,
        phase: 'completed',
        statusText: `Connected to Gmail IMAP SSL (${creds.email}) successfully!`,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to authenticate with IMAP server.';
      setAuthError(msg);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDisconnect = () => {
    clearStoredCredentials();
    setCredentials(null);
    setIsConnected(false);
    setActivityLogs([]);
    setLastExport(null);
    setProgress({
      total: 0,
      current: 0,
      phase: 'idle',
      statusText: 'Disconnected from Gmail IMAP.',
    });
  };

  /**
   * Action: Reset History (Start from 0)
   * Strips / deletes 'Downloaded' label on Gmail and resets counters to 0
   */
  const handleResetToZero = async () => {
    if (!credentials || !isConnected) {
      setErrorBanner('Please connect your Gmail account with App Password first.');
      return;
    }

    setIsResettingTags(true);
    setProgress({
      total: 100,
      current: 30,
      phase: 'resetting',
      statusText: 'Connecting to Gmail IMAP to remove "Downloaded" label from all emails...',
    });

    try {
      const result = await resetDownloadedTagsViaBackend(
        credentials.email,
        credentials.appPassword
      );

      setStats({
        totalFetched: 0,
        totalBytes: 0,
        lastRunAt: null,
      });
      setActivityLogs([]);
      setLastExport(null);

      setProgress({
        total: 100,
        current: 100,
        phase: 'completed',
        statusText: `Reset complete! Removed "Downloaded" tag from ${result.count} email(s) on Gmail. All emails stay bold & unread and can be downloaded again.`,
      });
    } catch (err: any) {
      console.error('Failed to reset tags on Gmail:', err);
      setProgress({
        total: 0,
        current: 0,
        phase: 'error',
        statusText: 'Reset error: ' + (err?.message || 'Could not reach IMAP server to remove labels.'),
      });
      setErrorBanner(err.message || 'Failed to remove Downloaded labels.');
    } finally {
      setIsResettingTags(false);
    }
  };

  /**
   * Action 1: Extract Emails (Fast preview via IMAP metadata)
   */
  const handleExtractEmails = async () => {
    if (!credentials || !isConnected) {
      setErrorBanner('Please connect your Gmail account with App Password first.');
      return;
    }

    setIsExtracting(true);
    setErrorBanner(null);

    const activeCatLabel =
      EMAIL_CATEGORIES.find((c) => c.id === category)?.label || category;

    setProgress({
      total: downloadCount,
      current: 10,
      phase: 'searching',
      statusText: `Querying Gmail IMAP for unread emails in "${activeCatLabel}"...`,
    });

    try {
      const res = await extractEmailsViaBackend(
        credentials.email,
        credentials.appPassword,
        category,
        downloadCount,
        customQuery,
        dateFilter
      );

      if (!res.items || res.items.length === 0) {
        setProgress({
          total: 0,
          current: 0,
          phase: 'completed',
          statusText: `No unread, non-downloaded emails found in "${activeCatLabel}" matching your filters.`,
        });
        setActivityLogs([]);
        return;
      }

      setActivityLogs(res.items);
      setProgress({
        total: res.items.length,
        current: res.items.length,
        phase: 'completed',
        statusText: `Successfully extracted ${res.items.length} email headers from "${activeCatLabel}". Kept unread in Gmail.`,
      });
    } catch (err: any) {
      console.error('Extract error:', err);
      setErrorBanner(err.message || 'Failed to extract emails.');
      setProgress((prev) => ({
        ...prev,
        phase: 'error',
        statusText: `Extract failed: ${err.message || 'Error'}`,
      }));
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * Action 2: Batch Download & Packaging
   */
  const handleFetchAndDownload = async () => {
    if (!credentials || !isConnected) {
      setErrorBanner('Please connect your Gmail account with App Password first.');
      return;
    }

    setIsLoading(true);
    setErrorBanner(null);
    setLastExport(null);

    const activeCatLabel =
      EMAIL_CATEGORIES.find((c) => c.id === category)?.label || category;

    setProgress({
      total: downloadCount,
      current: 10,
      phase: 'searching',
      statusText: `Connecting to IMAP SSL, searching unread emails in "${activeCatLabel}"...`,
    });

    try {
      const res = await downloadEmailsViaBackend(
        credentials.email,
        credentials.appPassword,
        category,
        downloadCount,
        cleanHeadersConfig,
        customQuery,
        dateFilter
      );

      setLastExport({
        blob: res.blob,
        filename: res.filename,
        totalSize: res.totalSize,
        totalFiles: res.totalCount,
      });

      setStats((prev) => ({
        totalFetched: prev.totalFetched + res.totalCount,
        totalBytes: prev.totalBytes + res.totalSize,
        lastRunAt: new Date().toLocaleTimeString(),
      }));

      setProgress({
        total: res.totalCount,
        current: res.totalCount,
        phase: 'completed',
        statusText: `Successfully exported ${res.totalCount} emails to ${res.filename}! All emails remain bold & unread in Gmail and tagged with 'Downloaded'.`,
      });
    } catch (err: any) {
      console.error('Batch download error:', err);
      setErrorBanner(err.message || 'An error occurred during IMAP batch download.');
      setProgress((prev) => ({
        ...prev,
        phase: 'error',
        statusText: `Download failed: ${err.message || 'Error'}`,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const activeCategoryLabel =
    EMAIL_CATEGORIES.find((c) => c.id === category)?.label || category;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header & Account Login */}
      <AuthBar
        credentials={credentials}
        isConnected={isConnected}
        isAuthenticating={isAuthenticating}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        error={authError}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Error Notification */}
        {errorBanner && (
          <div
            id="error-banner"
            className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-rose-800 text-xs shadow-xs animate-fadeIn"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Notice: </span>
                <span>{errorBanner}</span>
              </div>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-rose-500 hover:text-rose-700 font-bold px-2 py-0.5 rounded-md hover:bg-rose-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success Export Notification */}
        {lastExport && (
          <div
            id="success-export-banner"
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-900 shadow-xs animate-fadeIn"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <FileArchive className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-emerald-950 flex items-center gap-2">
                  <span>Archive Downloaded: {lastExport.filename}</span>
                  <span className="px-2 py-0.5 bg-emerald-200/60 text-emerald-800 rounded-full font-mono text-[11px]">
                    {(lastExport.totalSize / 1024).toFixed(1)} KB
                  </span>
                </div>
                <p className="text-emerald-700 mt-0.5">
                  Contains {lastExport.totalFiles} raw MIME .eml files. All downloaded emails remain completely unread on Gmail and tagged with 'Downloaded'.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                const url = URL.createObjectURL(lastExport.blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = lastExport.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-xs shrink-0 self-end sm:self-auto cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Re-download ZIP
            </button>
          </div>
        )}

        {/* Session Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/70 p-4 rounded-2xl shadow-2xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Emails Downloaded
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {stats.totalFetched}
            </div>
          </div>
          <div className="bg-white border border-slate-200/70 p-4 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Deduplication
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                Gmail Label
              </span>
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">
              label:Downloaded
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Excluded via -label:Downloaded
            </div>
          </div>
          <div className="bg-white border border-slate-200/70 p-4 rounded-2xl shadow-2xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Archive Size
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {stats.totalBytes > 0
                ? `${(stats.totalBytes / (1024 * 1024)).toFixed(2)} MB`
                : '0 KB'}
            </div>
          </div>
          <div className="bg-white border border-slate-200/70 p-4 rounded-2xl shadow-2xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Last Backup Run
            </div>
            <div className="text-xl font-bold text-slate-700 mt-1">
              {stats.lastRunAt || 'None'}
            </div>
          </div>
        </div>

        {/* Controls Card with IMAP category selection, header formatting & Action buttons */}
        <Controls
          category={category}
          onCategoryChange={setCategory}
          customQuery={customQuery}
          onCustomQueryChange={setCustomQuery}
          count={downloadCount}
          onCountChange={setDownloadCount}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          cleanHeadersConfig={cleanHeadersConfig}
          onCleanHeadersConfigChange={handleCleanHeadersConfigChange}
          onExtract={handleExtractEmails}
          onFetchAndDownload={handleFetchAndDownload}
          onResetToZero={handleResetToZero}
          isResetting={isResettingTags}
          isLoading={isLoading}
          isExtracting={isExtracting}
          hasAuth={isConnected}
          onConnectClick={() => {
            const input = document.getElementById('gmail-email-input');
            input?.focus();
          }}
          availableCategories={[]}
          isLoadingCategories={false}
          onRefreshCategories={() => {}}
        />

        {/* Progress Bar */}
        <ProgressBar progress={progress} />

        {/* Activity Table and Logs */}
        <ActivityTable
          items={activityLogs}
          onPreviewEml={(item) => setPreviewEmail(item)}
          activeCategoryName={activeCategoryLabel}
          defaultSortOrder={dateFilter.sortOrder}
          onSortOrderChange={(order) =>
            setDateFilter((prev) => ({ ...prev, sortOrder: order }))
          }
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Gmail EML Downloader • Node.js IMAPflow (SSL:993)</span>
          <span className="font-mono text-[11px] text-slate-400">
            16-character App Password • RFC 2822 Extraction &amp; Zip Package
          </span>
        </div>
      </footer>

      {/* EML Preview Modal */}
      <EmlPreviewModal
        email={previewEmail}
        onClose={() => setPreviewEmail(null)}
      />
    </div>
  );
}
