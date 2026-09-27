import React, { useState } from 'react';
import {
  LogOut,
  Mail,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { GmailCredentials } from '../services/auth';

interface AuthBarProps {
  credentials: GmailCredentials | null;
  isConnected: boolean;
  isAuthenticating: boolean;
  onConnect: (creds: GmailCredentials) => Promise<void>;
  onDisconnect: () => void;
  error?: string | null;
}

export const AuthBar: React.FC<AuthBarProps> = ({
  credentials,
  isConnected,
  isAuthenticating,
  onConnect,
  onDisconnect,
  error,
}) => {
  const [emailInput, setEmailInput] = useState<string>(credentials?.email || '');
  const [passwordInput, setPasswordInput] = useState<string>(credentials?.appPassword || '');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanEmail = emailInput.trim();
    const cleanPass = passwordInput.replace(/\s+/g, '').trim();

    if (!cleanEmail) {
      setLocalError('Please enter your Gmail address.');
      return;
    }
    if (!cleanPass) {
      setLocalError('Please enter your 16-character Gmail App Password.');
      return;
    }
    if (cleanPass.length < 16) {
      setLocalError('Google App Passwords are 16 letters (e.g. abcd efgh ijkl mnop).');
    }

    try {
      await onConnect({ email: cleanEmail, appPassword: cleanPass });
    } catch (err: any) {
      setLocalError(err.message || 'Failed to authenticate with IMAP server.');
    }
  };

  const activeError = error || localError;

  return (
    <div className="w-full">
      {/* Top Navigation Bar */}
      <header
        id="main-header"
        className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Gmail EML Downloader
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  IMAP SSL:993
                </span>
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Direct Node.js IMAP unread extraction, header formatting &amp; ZIP package
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isConnected && credentials ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 pl-3 pr-2 py-1.5 rounded-xl">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>

                <div className="text-left max-w-[160px] sm:max-w-[240px]">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {credentials.email}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-medium truncate flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Verified &amp; Connected
                  </div>
                </div>

                <button
                  id="disconnect-account-btn"
                  onClick={onDisconnect}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 cursor-pointer"
                  title="Disconnect Account / Change Password"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Authentication Required</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Account Login Card (shown prominently if not connected) */}
      {!isConnected && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    Gmail IMAP Account Login
                  </h2>
                  <p className="text-xs text-slate-500">
                    Connect securely using your Gmail address and 16-character App Password
                  </p>
                </div>
              </div>

              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100/80 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
              >
                <span>Generate Gmail App Password</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {activeError && (
              <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>{activeError}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-end">
              {/* Email Address */}
              <div className="sm:col-span-5">
                <label
                  htmlFor="gmail-email-input"
                  className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Gmail Address</span>
                </label>
                <div className="relative">
                  <input
                    id="gmail-email-input"
                    type="email"
                    required
                    placeholder="e.g. yourname@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    disabled={isAuthenticating}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono"
                  />
                </div>
              </div>

              {/* 16-character App Password */}
              <div className="sm:col-span-4">
                <label
                  htmlFor="gmail-app-password-input"
                  className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    <span>App Password (16 chars)</span>
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="gmail-app-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    disabled={isAuthenticating}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-3.5 pr-10 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Verify & Connect Button */}
              <div className="sm:col-span-3">
                <button
                  id="verify-connect-btn"
                  type="submit"
                  disabled={isAuthenticating || !emailInput || !passwordInput}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  {isAuthenticating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying IMAP...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify &amp; Connect</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 gap-1">
              <span>
                Note: Google requires 2-Step Verification to create an App Password.
              </span>
              <span className="font-mono text-slate-400">
                Credentials saved securely in your browser session.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
