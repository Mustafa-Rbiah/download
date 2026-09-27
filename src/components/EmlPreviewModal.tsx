import React, { useState } from 'react';
import { FileText, Download, Copy, Check, X } from 'lucide-react';
import { EmailItem } from '../types';

interface EmlPreviewModalProps {
  email: EmailItem | null;
  onClose: () => void;
}

export const EmlPreviewModal: React.FC<EmlPreviewModalProps> = ({ email, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!email?.emlBlob) {
      setContent('');
      return;
    }
    setLoading(true);
    email.emlBlob
      .text()
      .then((txt) => {
        setContent(txt);
        setLoading(false);
      })
      .catch((err) => {
        setContent(`Error reading .eml blob: ${err.message}`);
        setLoading(false);
      });
  }, [email]);

  if (!email) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    if (!email.emlBlob) return;
    const url = URL.createObjectURL(email.emlBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${email.id}.eml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="eml-preview-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
    >
      <div
        id="eml-preview-dialog"
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                {email.subject}
              </h3>
              <p className="text-[11px] font-mono text-slate-500">
                Message ID: {email.id} (.eml MIME source)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed select-text">
          {loading ? (
            <div className="text-slate-400 py-12 text-center">Loading MIME headers and body...</div>
          ) : (
            <pre className="whitespace-pre-wrap break-all">{content}</pre>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="text-slate-500">
            Size: {email.emlBlob ? `${(email.emlBlob.size / 1024).toFixed(1)} KB` : 'Unknown'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Source'}
            </button>
            <button
              onClick={handleDownloadSingle}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download .EML
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
