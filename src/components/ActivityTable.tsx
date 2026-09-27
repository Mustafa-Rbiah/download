import React, { useState, useMemo } from 'react';
import {
  Mail,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Eye,
  Download,
  FileText,
  Search,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Calendar,
} from 'lucide-react';
import { EmailItem, SortOrder } from '../types';

interface ActivityTableProps {
  items: EmailItem[];
  onPreviewEml?: (item: EmailItem) => void;
  onDownloadSingleEml?: (item: EmailItem) => void;
  activeCategoryName?: string;
  defaultSortOrder?: SortOrder;
  onSortOrderChange?: (order: SortOrder) => void;
}

export const ActivityTable: React.FC<ActivityTableProps> = ({
  items,
  onPreviewEml,
  onDownloadSingleEml,
  activeCategoryName,
  defaultSortOrder = 'newest',
  onSortOrderChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [localSortOrder, setLocalSortOrder] = useState<SortOrder>(defaultSortOrder);

  const activeSort = defaultSortOrder || localSortOrder;

  const handleToggleSort = () => {
    const next: SortOrder = activeSort === 'newest' ? 'oldest' : 'newest';
    setLocalSortOrder(next);
    if (onSortOrderChange) {
      onSortOrderChange(next);
    }
  };

  const formatDateTime = (rawDate?: string) => {
    if (!rawDate) return '—';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return rawDate.replace(/ \+\d{4}.*$/, '');
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return rawDate;
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    let list = [...items];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (it) =>
          it.subject.toLowerCase().includes(q) ||
          it.from.toLowerCase().includes(q) ||
          (it.snippet && it.snippet.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return activeSort === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return list;
  }, [items, searchTerm, activeSort]);

  if (items.length === 0) {
    return (
      <div
        id="empty-activity-state"
        className="text-center py-16 px-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs"
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
          <Mail className="w-6 h-6 stroke-[1.75]" />
        </div>
        <h4 className="text-sm font-semibold text-slate-700">No emails in Activity Log yet</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Select a category above and click <strong>Extract</strong> to view all emails in this category, or click <strong>Download ZIP</strong> to export raw .eml backups.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: EmailItem['status'], error?: string) => {
    switch (status) {
      case 'extracted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            Extracted & Listed
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Downloaded (Unread Preserved)
          </span>
        );
      case 'marking_read':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            Saving to Memory...
          </span>
        );
      case 'decoding':
      case 'fetching':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            Fetching .EML...
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Queued
          </span>
        );
      case 'error':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200"
            title={error || 'Failed to process email'}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Error
          </span>
        );
    }
  };

  return (
    <div
      id="activity-table-container"
      className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"
    >
      <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Activity Log</h3>
              {activeCategoryName && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  Category: {activeCategoryName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing extracted or downloaded emails for this category
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort order toggle button */}
            <button
              id="table-sort-order-btn"
              onClick={handleToggleSort}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Toggle sort order between new to old and old to new"
            >
              {activeSort === 'newest' ? (
                <>
                  <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>New Mail to Old Mail (Newest First)</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                  <span>Old Mail to New Mail (Oldest First)</span>
                </>
              )}
            </button>

            <span className="text-xs font-mono px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
              {filteredAndSortedItems.length} of {items.length} {items.length === 1 ? 'Message' : 'Messages'}
            </span>
          </div>
        </div>

        {/* Filter / Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search extracted emails by subject or sender..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table id="activity-table" className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/60 text-slate-500 font-semibold tracking-wider uppercase">
              <th className="py-3 px-4 sm:px-6">Subject</th>
              <th className="py-3 px-4">Sender</th>
              <th
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                onClick={handleToggleSort}
                title="Click to change date sort order"
              >
                <div className="flex items-center gap-1">
                  <span>Date & Time</span>
                  {activeSort === 'newest' ? (
                    <ArrowDown className="w-3 h-3 text-blue-600" />
                  ) : (
                    <ArrowUp className="w-3 h-3 text-blue-600" />
                  )}
                </div>
              </th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
            {filteredAndSortedItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 max-w-xs sm:max-w-sm truncate">
                  <div className="truncate font-semibold text-slate-900" title={item.subject}>
                    {item.subject}
                  </div>
                  {item.snippet && (
                    <div className="text-[11px] text-slate-400 truncate mt-0.5" title={item.snippet}>
                      {item.snippet}
                    </div>
                  )}
                </td>
                <td className="py-3.5 px-4 text-slate-600 max-w-[180px] truncate" title={item.from}>
                  {item.from}
                </td>
                <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap" title={item.date}>
                  <div className="font-mono text-[11px] text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{formatDateTime(item.date)}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {getStatusBadge(item.status, item.error)}
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  {item.emlBlob && onPreviewEml ? (
                    <button
                      onClick={() => onPreviewEml(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 text-[11px] font-semibold border border-slate-200 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      Preview .EML
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[11px] italic">Ready to Download</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
