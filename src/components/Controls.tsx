import React, { useState } from 'react';
import {
  Filter,
  ArrowDownToLine,
  Sparkles,
  AlertCircle,
  ChevronDown,
  Layers,
  Search,
  Eye,
  RefreshCw,
  Inbox,
  CheckCircle2,
  Lock,
  Calendar,
  Clock,
  ArrowUpDown,
  SlidersHorizontal,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  EmailCategory,
  CategoryOption,
  DiscoveredCategory,
  EMAIL_CATEGORIES,
  DateFilterConfig,
  DateFilterPreset,
  SortOrder,
  CleanHeadersConfig,
  DEFAULT_CLEAN_HEADERS_CONFIG,
} from '../types';
import { CleanHeadersOptions } from './CleanHeadersOptions';

interface ControlsProps {
  category: EmailCategory;
  onCategoryChange: (c: EmailCategory) => void;
  customQuery: string;
  onCustomQueryChange: (q: string) => void;
  count: number;
  onCountChange: (cnt: number) => void;
  onExtract: () => void;
  onFetchAndDownload: () => void;
  onResetToZero?: () => void;
  isResetting?: boolean;
  isLoading: boolean;
  isExtracting: boolean;
  hasAuth: boolean;
  onConnectClick: () => void;
  availableCategories: DiscoveredCategory[];
  isLoadingCategories: boolean;
  onRefreshCategories: () => void;
  dateFilter: DateFilterConfig;
  onDateFilterChange: (df: DateFilterConfig) => void;
  cleanHeadersConfig?: CleanHeadersConfig;
  onCleanHeadersConfigChange?: (cfg: CleanHeadersConfig) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  category,
  onCategoryChange,
  customQuery,
  onCustomQueryChange,
  count,
  onCountChange,
  onExtract,
  onFetchAndDownload,
  onResetToZero,
  isResetting,
  isLoading,
  isExtracting,
  hasAuth,
  onConnectClick,
  availableCategories,
  isLoadingCategories,
  onRefreshCategories,
  dateFilter,
  onDateFilterChange,
  cleanHeadersConfig = DEFAULT_CLEAN_HEADERS_CONFIG,
  onCleanHeadersConfigChange,
}) => {
  const quickCounts = [20, 50, 100, 200, 300];

  // Filter out any spam categories
  const filteredCategories = availableCategories.filter(
    (c) => c.id !== 'spam' && !c.label.toLowerCase().includes('spam')
  );

  const displayCategories =
    filteredCategories.length > 0
      ? filteredCategories
      : EMAIL_CATEGORIES.filter(
          (c) => c.id !== 'spam' && !c.label.toLowerCase().includes('spam')
        );

  const selectedCatObj = displayCategories.find((c) => c.id === category);

  const handlePresetSelect = (preset: DateFilterPreset) => {
    const now = new Date();
    let startDate: string | undefined = undefined;
    let endDate: string | undefined = undefined;

    if (preset === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      startDate = todayStart.toISOString().slice(0, 16);
    } else if (preset === '7days') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = past7.toISOString().slice(0, 16);
    } else if (preset === '30days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = past30.toISOString().slice(0, 16);
    }

    onDateFilterChange({
      ...dateFilter,
      preset,
      startDate: preset === 'custom' ? dateFilter.startDate : startDate,
      endDate: preset === 'custom' ? dateFilter.endDate : endDate,
    });
  };

  const handleSortToggle = () => {
    const nextOrder: SortOrder = dateFilter.sortOrder === 'newest' ? 'oldest' : 'newest';
    onDateFilterChange({
      ...dateFilter,
      sortOrder: nextOrder,
    });
  };

  return (
    <div
      id="controls-card"
      className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            Email Category &amp; Extraction Controls
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasAuth
              ? 'IMAP SSL unread email extraction with automatic exclusion (-label:Downloaded)'
              : 'Enter your Gmail address and 16-character App Password to start downloading'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          {hasAuth && selectedCatObj && (
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                selectedCatObj.badgeColor || 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              Active: {selectedCatObj.label}
            </span>
          )}
          <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unread Preserved + Tagged Downloaded</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-5">
        {/* Category Selector */}
        <div className="md:col-span-5">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="category-select"
              className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Select Email Category
            </label>
            {hasAuth && (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                IMAP Search Ready
              </span>
            )}
          </div>

          <div className="relative">
            {!hasAuth ? (
              <div
                id="category-locked-box"
                onClick={onConnectClick}
                className="w-full flex items-center justify-between bg-slate-50/90 border border-dashed border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-500 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-600">
                    Connect account with App Password to unlock
                  </span>
                </div>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  Connect
                </span>
              </div>
            ) : (
              <select
                id="category-select"
                value={category}
                disabled={isLoading || isExtracting}
                onChange={(e) => onCategoryChange(e.target.value as EmailCategory)}
                className="w-full appearance-none bg-slate-50/70 hover:bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer disabled:opacity-60"
              >
                <optgroup label="Standard Gmail Categories">
                  <option value="primary">Primary (category:primary)</option>
                  <option value="promotions">Promotions (category:promotions)</option>
                  <option value="updates">Updates (category:updates)</option>
                  <option value="social">Social (category:social)</option>
                  <option value="forums">Forums (category:forums)</option>
                  <option value="inbox">Primary Inbox (label:inbox)</option>
                  <option value="all">All Mail (Any Category)</option>
                </optgroup>
                <optgroup label="Custom Search">
                  <option value="custom">Custom Gmail Search Query...</option>
                </optgroup>
              </select>
            )}

            {hasAuth && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Description pill */}
          {hasAuth && selectedCatObj && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {selectedCatObj.description}
              </span>
            </div>
          )}

          {/* If Custom Query is chosen, show input */}
          {category === 'custom' && hasAuth && (
            <div className="mt-3 animate-fadeIn">
              <label
                htmlFor="custom-query-input"
                className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1"
              >
                <Search className="w-3 h-3 text-purple-600" />
                Custom Search Operator
              </label>
              <input
                id="custom-query-input"
                type="text"
                placeholder="e.g. from:amazon.com is:unread"
                value={customQuery}
                disabled={isLoading || isExtracting}
                onChange={(e) => onCustomQueryChange(e.target.value)}
                className="w-full bg-purple-50/40 border border-purple-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              />
            </div>
          )}
        </div>

        {/* Count Input */}
        <div className="md:col-span-3">
          <label
            htmlFor="download-count-input"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
          >
            Email Limit / Batch Count
          </label>
          <div className="relative">
            <input
              id="download-count-input"
              type="number"
              min={1}
              max={300}
              disabled={isLoading || isExtracting}
              value={count}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  onCountChange(Math.max(1, Math.min(val, 300)));
                } else {
                  onCountChange(1);
                }
              }}
              className="w-full bg-slate-50/70 hover:bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
            <span className="absolute right-3.5 top-3.5 text-xs text-slate-400 font-medium">
              max 300
            </span>
          </div>

          <div className="flex gap-1.5 mt-2">
            {quickCounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onCountChange(q)}
                disabled={isLoading || isExtracting}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                  count === q
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons: Extract, Download, & Reset to 0 */}
        <div className="md:col-span-4 flex flex-col justify-end space-y-2">
          {hasAuth ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {/* Extract Button */}
                <button
                  id="extract-emails-btn"
                  onClick={onExtract}
                  disabled={isLoading || isExtracting || isResetting}
                  title="Extract emails to view list and details in Activity Log without downloading ZIP"
                  className="w-full py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 active:scale-[0.98] text-slate-800 text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isExtracting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 text-slate-700 stroke-[2.2]" />
                      <span>Extract</span>
                    </>
                  )}
                </button>

                {/* Download Button */}
                <button
                  id="fetch-download-emails-btn"
                  onClick={onFetchAndDownload}
                  disabled={isLoading || isExtracting || isResetting}
                  title="Download all emails as .eml in a ZIP file (unread preserved, tags Downloaded)"
                  className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-4 h-4" />
                      <span>Start Download</span>
                    </>
                  )}
                </button>
              </div>

              {/* Reset History (Start from 0) Button */}
              {onResetToZero && (
                <button
                  id="reset-history-btn"
                  onClick={onResetToZero}
                  disabled={isLoading || isExtracting || isResetting}
                  title="Removes 'Downloaded' label from Gmail so all emails can be downloaded again from zero"
                  className="w-full py-2 px-3 rounded-xl bg-rose-50/80 hover:bg-rose-100/80 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isResetting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-rose-400 border-t-rose-800 rounded-full animate-spin" />
                      <span>Resetting &amp; Removing Tags from Gmail...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reset History (Start from 0)</span>
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <button
              id="connect-account-btn"
              onClick={onConnectClick}
              className="w-full py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Connect Account to Unlock</span>
            </button>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
            <span>Extract previews</span>
            <span>Reset clears 'Downloaded' tag</span>
          </div>
        </div>
      </div>

      {/* Date & Time Filter and Sort Order Toolbar */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Date &amp; Time Filter:</span>
          </span>

          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 gap-0.5">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Past 7 Days' },
              { id: '30days', label: 'Past 30 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetSelect(p.id as DateFilterPreset)}
                disabled={isLoading || isExtracting}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  dateFilter.preset === p.id
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {(dateFilter.startDate || dateFilter.endDate || dateFilter.preset !== 'all') && (
            <button
              type="button"
              onClick={() =>
                onDateFilterChange({
                  ...dateFilter,
                  preset: 'all',
                  startDate: undefined,
                  endDate: undefined,
                })
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
              title="Reset date filter"
            >
              <X className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Sort Order: New mail to old mail vs Old mail to new mail */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-slate-500 font-medium text-[11px]">Order:</span>
          <button
            type="button"
            onClick={handleSortToggle}
            disabled={isLoading || isExtracting}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-all cursor-pointer"
            title="Toggle sort direction"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {dateFilter.sortOrder === 'newest'
                ? 'New Mail to Old Mail (Newest First)'
                : 'Old Mail to New Mail (Oldest First)'}
            </span>
          </button>
        </div>
      </div>

      {/* Expanded Custom Date & Time pickers */}
      {dateFilter.preset === 'custom' && (
        <div className="mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-600" />
              From Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={dateFilter.startDate || ''}
              disabled={isLoading || isExtracting}
              onChange={(e) =>
                onDateFilterChange({ ...dateFilter, startDate: e.target.value })
              }
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-600" />
              To Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={dateFilter.endDate || ''}
              disabled={isLoading || isExtracting}
              onChange={(e) =>
                onDateFilterChange({ ...dateFilter, endDate: e.target.value })
              }
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
          </div>
        </div>
      )}

      {/* Clean & Format Headers Option */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label
            htmlFor="clean-headers-checkbox-main"
            className="flex items-start sm:items-center gap-2.5 cursor-pointer select-none group"
          >
            <input
              id="clean-headers-checkbox-main"
              type="checkbox"
              checked={cleanHeadersConfig.enabled}
              disabled={isLoading || isExtracting}
              onChange={(e) =>
                onCleanHeadersConfigChange?.({
                  ...cleanHeadersConfig,
                  enabled: e.target.checked,
                })
              }
              className="mt-0.5 sm:mt-0 w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <span className="font-semibold text-slate-800 flex items-center gap-1.5 group-hover:text-blue-700 transition-colors">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Clean &amp; Format Headers before saving (Nettoyer/Formater les en-têtes)</span>
            </span>
          </label>

          {cleanHeadersConfig.enabled ? (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1 self-start sm:self-auto">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Templates active ({cleanHeadersConfig.fromEnabled ? 'From' : ''}
              {cleanHeadersConfig.toEnabled ? ', To' : ''}
              {cleanHeadersConfig.ccEnabled ? ', Cc' : ''}
              {cleanHeadersConfig.dateEnabled ? ', Date' : ''}
              {cleanHeadersConfig.messageIdEnabled ? ', Msg-ID' : ''})
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
              Body &amp; headers preserved raw
            </span>
          )}
        </div>

        {/* Customizable Options (Dropdowns & Checkboxes) */}
        {cleanHeadersConfig.enabled && (
          <div className="mt-1">
            <CleanHeadersOptions
              config={cleanHeadersConfig}
              onChange={(updated) => onCleanHeadersConfigChange?.(updated)}
              disabled={isLoading || isExtracting}
            />
          </div>
        )}
      </div>
    </div>
  );
};
