"use client";

import { useState, useCallback } from "react";

interface LicenseDisplayProps {
  licenseKey: string;
  expiresAt: string;
  isNewUser: boolean;
  txHash?: string;
  onReset: () => void;
}

export function LicenseDisplay({
  licenseKey,
  expiresAt,
  isNewUser,
  txHash,
  onReset,
}: LicenseDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers with strict clipboard permissions
      const textarea = document.createElement("textarea");
      textarea.value = licenseKey;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [licenseKey]);

  const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bscTxUrl = txHash
    ? `https://bscscan.com/tx/${txHash}`
    : undefined;

  return (
    <div className="animate-slide-up space-y-6">
      {/* Success header */}
      <div className="text-center">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 border border-success/30">
          <svg
            className="w-8 h-8 text-success"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">
          {isNewUser ? "License Activated!" : "Subscription Renewed!"}
        </h2>
        <p className="text-sm text-slate-400">
          {isNewUser
            ? "Your 30-day subscription is now active."
            : "Your subscription has been extended by 30 days."}
        </p>
      </div>

      {/* License key card */}
      <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-teal-400 uppercase tracking-wider">
            License Key
          </span>
          <span className="text-xs text-slate-500">Keep this safe</span>
        </div>

        <div className="flex items-center gap-3">
          {/* The license key itself */}
          <code className="flex-1 font-mono text-lg font-semibold text-white tracking-widest bg-navy-900 border border-navy-700 rounded-lg px-4 py-3 break-all">
            {licenseKey}
          </code>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            aria-label="Copy license key to clipboard"
            className={`
              flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-lg
              font-medium text-sm transition-all duration-200
              ${
                copied
                  ? "bg-success/20 text-success border border-success/40"
                  : "bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 hover:border-teal-500/50"
              }
            `}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Subscription details */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-navy-700 bg-navy-900/50 p-4">
          <p className="text-xs text-slate-500 mb-1">Subscription Period</p>
          <p className="text-sm font-semibold text-white">30 Days</p>
        </div>
        <div className="rounded-lg border border-navy-700 bg-navy-900/50 p-4">
          <p className="text-xs text-slate-500 mb-1">Expires On</p>
          <p className="text-sm font-semibold text-white">{expiryDate}</p>
        </div>
      </div>

      {/* TX explorer link */}
      {bscTxUrl && (
        <a
          href={bscTxUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full text-sm text-slate-400 hover:text-teal-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View transaction on BscScan
        </a>
      )}

      {/* Advisory */}
      <div className="rounded-lg bg-gold-500/5 border border-gold-500/20 p-4 flex gap-3">
        <svg className="w-5 h-5 text-gold-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-xs text-slate-400 leading-relaxed">
          Store your license key securely. It cannot be recovered if lost. To renew, simply send another 30 USDT payment from the same wallet — your key will be preserved.
        </p>
      </div>

      {/* New purchase button */}
      <button
        onClick={onReset}
        className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
      >
        Make another purchase with a different wallet
      </button>
    </div>
  );
}
