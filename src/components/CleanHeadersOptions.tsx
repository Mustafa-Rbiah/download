import React from 'react';
import {
  CleanHeadersConfig,
  DEFAULT_CLEAN_HEADERS_CONFIG,
} from '../types';
import {
  Sparkles,
  Calendar,
  Mail,
  Hash,
  User,
  Type,
  RotateCcw,
  Eye,
  CheckSquare2,
  Info,
} from 'lucide-react';

interface CleanHeadersOptionsProps {
  config: CleanHeadersConfig;
  onChange: (updated: CleanHeadersConfig) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const CleanHeadersOptions: React.FC<CleanHeadersOptionsProps> = ({
  config,
  onChange,
  disabled = false,
  compact = false,
}) => {
  const updateField = <K extends keyof CleanHeadersConfig>(
    field: K,
    value: CleanHeadersConfig[K]
  ) => {
    onChange({
      ...config,
      [field]: value,
    });
  };

  const handleResetDefaults = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange({
      ...DEFAULT_CLEAN_HEADERS_CONFIG,
      enabled: config.enabled,
    });
  };

  // Compute live preview string based on current user inputs
  const fromReplacement = (config.fromDomainReplacement || config.fromTemplate || '[RDNS]').trim().replace(/^@/, '') || '[RDNS]';
  const previewFrom = config.fromEnabled
    ? `From: "Quartz Crypto" <crypto@${fromReplacement}>`
    : 'From: "Quartz Crypto" <crypto@sgssdgsfzfzezzzfzf> (original preserved)';

  const previewTo = config.toEnabled
    ? `To: ${config.toTemplate.replace(/^To:\s*/i, '') || '[*to]'}`
    : 'To: recipient@destination.com (original preserved)';

  const previewCc = config.ccEnabled
    ? `Cc: ${config.ccTemplate.replace(/^Cc:\s*/i, '') || '[*to]'} ${
        config.ccAlwaysPresent ? '(always inserted)' : '(if present in email)'
      }`
    : 'Cc: (original preserved)';

  const previewDate = config.dateEnabled
    ? `Date: ${config.dateTemplate.replace(/^Date:\s*/i, '') || '[DATE]'}`
    : 'Date: Wed, 24 Sep 2026 10:30:00 +0000 (original preserved)';

  const previewSubject = config.subjectEnabled
    ? `Subject: ${(config.subjectPrefix || 'RE: ').trimEnd()} Project Update`
    : 'Subject: Project Update (original preserved as-is)';

  const previewMsgId = config.messageIdEnabled
    ? `Message-ID: <987654${(config.messageIdTag || '[EID]').trim()}@mail.domain.com>`
    : 'Message-ID: <987654@mail.domain.com> (original preserved)';

  return (
    <div
      id="header-templates-configuration-panel"
      className={`rounded-2xl border transition-all ${
        config.enabled
          ? 'bg-slate-50/90 border-blue-200/90 shadow-2xs'
          : 'bg-slate-50 border-slate-200 opacity-60 pointer-events-none'
      } ${compact ? 'p-3.5 text-xs' : 'p-4 sm:p-5 text-xs'}`}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3.5 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
              Header Templates Configuration
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-1.5 py-0.2 rounded-md">
                Auto-saved
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Customize output format for each header. Body remains 100% untouched byte-for-byte.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={disabled || !config.enabled}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
          title="Restore factory default header templates"
        >
          <RotateCcw className="w-3 h-3 text-slate-500" />
          <span>Reset to Defaults</span>
        </button>
      </div>

      {/* Configuration Rows */}
      <div className="space-y-3">
        {/* Row 1: From */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/90 hover:border-blue-200 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="enable-from-checkbox"
                type="checkbox"
                checked={config.fromEnabled}
                disabled={disabled || !config.enabled}
                onChange={(e) => updateField('fromEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <User className="w-3.5 h-3.5 text-blue-600" />
                Replace domain after @ in From
              </span>
            </label>

            <div className="flex-1 sm:max-w-md">
              <input
                id="from-domain-input"
                type="text"
                value={config.fromDomainReplacement ?? config.fromTemplate ?? '[RDNS]'}
                disabled={disabled || !config.enabled || !config.fromEnabled}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange({
                    ...config,
                    fromDomainReplacement: val,
                    fromTemplate: val,
                  });
                }}
                placeholder="[RDNS]"
                className="w-full bg-slate-50 disabled:bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] text-slate-500 font-mono pl-6">
            <span className="text-slate-400 font-sans">Common values:</span>
            {['[RDNS]', '[P_RPATH]', '[RP]'].map((val) => (
              <button
                key={val}
                type="button"
                disabled={disabled || !config.enabled || !config.fromEnabled}
                onClick={() => {
                  onChange({
                    ...config,
                    fromDomainReplacement: val,
                    fromTemplate: val,
                  });
                }}
                className="bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer transition-colors border border-slate-200"
              >
                {val}
              </button>
            ))}
            <span className="text-slate-400 font-sans ml-1">
              • Keeps original sender name &amp; username intact
            </span>
          </div>
        </div>

        {/* Row 2: To */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/90 hover:border-blue-200 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="enable-to-checkbox"
                type="checkbox"
                checked={config.toEnabled}
                disabled={disabled || !config.enabled}
                onChange={(e) => updateField('toEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                Enable To: formatting
              </span>
            </label>

            <div className="flex-1 sm:max-w-md">
              <input
                id="to-template-input"
                type="text"
                value={config.toTemplate}
                disabled={disabled || !config.enabled || !config.toEnabled}
                onChange={(e) => updateField('toTemplate', e.target.value)}
                placeholder="[*to]"
                className="w-full bg-slate-50 disabled:bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Cc */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/90 hover:border-blue-200 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="enable-cc-checkbox"
                type="checkbox"
                checked={config.ccEnabled}
                disabled={disabled || !config.enabled}
                onChange={(e) => updateField('ccEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                Enable Cc: formatting
              </span>
            </label>

            <div className="flex-1 sm:max-w-md">
              <input
                id="cc-template-input"
                type="text"
                value={config.ccTemplate}
                disabled={disabled || !config.enabled || !config.ccEnabled}
                onChange={(e) => updateField('ccTemplate', e.target.value)}
                placeholder="[*to]"
                className="w-full bg-slate-50 disabled:bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 pl-6 flex items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="always-present-cc-checkbox"
                type="checkbox"
                checked={config.ccAlwaysPresent}
                disabled={disabled || !config.enabled || !config.ccEnabled}
                onChange={(e) => updateField('ccAlwaysPresent', e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-[11px] font-medium text-slate-700">
                Always present (insert after To: if Cc line is missing in email)
              </span>
            </label>
          </div>
        </div>

        {/* Row 4: Date */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/90 hover:border-blue-200 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="enable-date-checkbox"
                type="checkbox"
                checked={config.dateEnabled}
                disabled={disabled || !config.enabled}
                onChange={(e) => updateField('dateEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                Enable Date: formatting
              </span>
            </label>

            <div className="flex-1 sm:max-w-md">
              <input
                id="date-template-input"
                type="text"
                value={config.dateTemplate}
                disabled={disabled || !config.enabled || !config.dateEnabled}
                onChange={(e) => updateField('dateTemplate', e.target.value)}
                placeholder="[DATE]"
                className="w-full bg-slate-50 disabled:bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 pl-6">
            Replace Date: with user template (e.g., <code className="bg-slate-100 px-1 py-0.2 rounded text-slate-700">[DATE]</code> or <code className="bg-slate-100 px-1 py-0.2 rounded text-slate-700">[*Date]</code>).
          </p>
        </div>

        {/* Row 5: Subject */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/90 hover:border-blue-200 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="enable-subject-checkbox"
                type="checkbox"
                checked={config.subjectEnabled}
                disabled={disabled || !config.enabled}
                onChange={(e) => updateField('subjectEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Type className="w-3.5 h-3.5 text-violet-600" />
                Modify Subject (e.g. prepend RE:)
              </span>
            </label>

            <div className="flex-1 sm:max-w-md">
              <input
                id="subject-prefix-input"
                type="text"
                value={config.subjectPrefix}
                disabled={disabled || !config.enabled || !config.subjectEnabled}
                onChange={(e) => updateField('subjectPrefix', e.target.value)}
                placeholder="RE: "
                className="w-full bg-slate-50 disabled:bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 pl-6">
            {config.subjectEnabled
              ? 'Prepends prefix to subject line.'
              : 'Default: Subject remains unmodified and preserved 100% as-is.'}
          </p>
        </div>

        {/* Row 6: Message-ID */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/90 hover:border-blue-200 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="enable-message-id-checkbox"
                type="checkbox"
                checked={config.messageIdEnabled}
                disabled={disabled || !config.enabled}
                onChange={(e) => updateField('messageIdEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Hash className="w-3.5 h-3.5 text-blue-600" />
                Enable Message-ID tag
              </span>
            </label>

            <div className="flex-1 sm:max-w-md">
              <input
                id="message-id-tag-input"
                type="text"
                value={config.messageIdTag}
                disabled={disabled || !config.enabled || !config.messageIdEnabled}
                onChange={(e) => updateField('messageIdTag', e.target.value)}
                placeholder="[EID]"
                className="w-full bg-slate-50 disabled:bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 pl-6">
            Tag injected before @ inside Message-ID (e.g., <code className="bg-slate-100 px-1 py-0.2 rounded text-slate-700">&lt;123456{config.messageIdTag || '[EID]'}@domain.com&gt;</code>).
          </p>
        </div>
      </div>

      {/* Live Header Output Preview */}
      {config.enabled && (
        <div className="mt-4 pt-3.5 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              Live Header Transformation Preview
            </span>
            <span className="text-[10px] text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              RFC 2822 Output
            </span>
          </div>

          <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 font-mono text-[11px] space-y-1 overflow-x-auto shadow-inner border border-slate-800">
            <div className={config.fromEnabled ? 'text-emerald-400' : 'text-slate-400'}>
              {previewFrom}
            </div>
            <div className={config.toEnabled ? 'text-cyan-300' : 'text-slate-400'}>
              {previewTo}
            </div>
            <div className={config.ccEnabled ? 'text-indigo-300' : 'text-slate-400'}>
              {previewCc}
            </div>
            <div className={config.dateEnabled ? 'text-amber-300' : 'text-slate-400'}>
              {previewDate}
            </div>
            <div className={config.subjectEnabled ? 'text-purple-300' : 'text-slate-400'}>
              {previewSubject}
            </div>
            <div className={config.messageIdEnabled ? 'text-blue-300' : 'text-slate-400'}>
              {previewMsgId}
            </div>
            <div className="text-slate-500 pt-1 text-[10px] border-t border-slate-800 font-sans italic">
              [Email Body is appended here 100% byte-for-byte untouched]
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
