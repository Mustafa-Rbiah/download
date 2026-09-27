import React from 'react';
import { Loader2, Archive, CheckCircle2, AlertCircle } from 'lucide-react';
import { BatchProgress } from '../types';

interface ProgressBarProps {
  progress: BatchProgress;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  if (progress.phase === 'idle') return null;

  const percentage =
    progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : progress.phase === 'zipping'
      ? 95
      : progress.phase === 'resetting'
      ? 50
      : progress.phase === 'completed'
      ? 100
      : 10;

  const isComplete = progress.phase === 'completed';
  const isError = progress.phase === 'error';
  const isResetting = progress.phase === 'resetting';

  return (
    <div
      id="batch-progress-container"
      className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs transition-all animate-fadeIn"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          {progress.phase === 'searching' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          {progress.phase === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
          {progress.phase === 'zipping' && <Archive className="w-4 h-4 animate-bounce text-amber-600" />}
          {isResetting && <Loader2 className="w-4 h-4 animate-spin text-rose-600" />}
          {isComplete && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          {isError && <AlertCircle className="w-4 h-4 text-rose-600" />}

          <span className="text-xs font-semibold text-slate-800 tracking-tight">
            {progress.statusText}
          </span>
        </div>
        <div className="text-xs font-mono font-bold text-slate-700">
          {progress.total > 0 && (progress.phase === 'processing' || isResetting)
            ? `${progress.current} / ${progress.total} (${percentage}%)`
            : `${percentage}%`}
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            isError
              ? 'bg-rose-500'
              : isComplete
              ? 'bg-emerald-500'
              : isResetting
              ? 'bg-rose-500 animate-pulse'
              : progress.phase === 'zipping'
              ? 'bg-amber-500 animate-pulse'
              : 'bg-blue-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {progress.phase === 'searching' && 'Querying Gmail messages index...'}
          {progress.phase === 'processing' && 'Downloading RFC 822 .eml (BODY.PEEK[]) & attaching Downloaded label on server...'}
          {progress.phase === 'zipping' && 'Packaging into compressed .zip archive...'}
          {isResetting && 'Searching for emails with label:Downloaded and removing tags from Gmail server...'}
          {isComplete && 'Process finished successfully!'}
          {isError && 'Process encountered an error.'}
        </span>
        <span className="font-mono text-slate-400">UNREAD Preserved</span>
      </div>
    </div>
  );
};
