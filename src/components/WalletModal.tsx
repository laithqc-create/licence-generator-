"use client";
// ─────────────────────────────────────────────────────────────────────────────
// WalletModal — the ONLY wallet picker for payment
//
// Flow (AppKit-powered, standard dapp pattern):
//   1. "Browser extension" row  → instant connect via wagmi injected connector
//   2. "All wallets" row        → opens Reown AppKit: shows a QR (client-side,
//                                 reliable on mobile, app-to-app) or deep-links
//   3. Wallet connects → wagmi state updates → CheckoutCard shows
//      "Pay X USDT" → user approves the USDT transfer in their wallet.
// No custom QR / invoice backend involved.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useConnect } from "wagmi";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { appkitEnabled } from "@/lib/appkit";

interface Props {
  onClose:   () => void;
  priceUsdt: number;
}

export function WalletModal({ onClose, priceUsdt }: Props) {
  const { connect, connectors, isPending } = useConnect();
  const [mounted, setMounted] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  if (!mounted) return null;

  // From the active wagmi config (AppKit adapter config, or plain fallback)
  const unique = connectors.filter(
    (c, i, arr) => arr.findIndex(x => x.name === c.name) === i
  );
  const injConnector = unique.find(c => c.id === "injected" || c.name.toLowerCase().includes("injected"));

  const handleConnect = (connectorId: string, label: string) => {
    const target = unique.find(c => c.id === connectorId);
    if (!target) return;
    setConnecting(label);
    connect(
      { connector: target },
      {
        onSuccess: () => { onClose(); },
        onError: ()   => { setConnecting(null); },
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-gray-900">Connect your wallet</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Connect once — you&apos;ll approve the {priceUsdt} USDT transfer inside your wallet
          </p>
        </div>

        {/* Wallet list */}
        <div className="px-3 py-3 space-y-2">

          {/* Browser extension — instant connect when installed */}
          {injConnector && (
            <button
              key={injConnector.uid}
              onClick={() => handleConnect(injConnector.id, injConnector.name)}
              disabled={!!connecting}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-60 border border-dashed border-gray-200"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-lg flex-shrink-0">
                🔌
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{injConnector.name} · Instant</p>
                <p className="text-xs text-gray-400">
                  {connecting === injConnector.name ? "Connecting…" : "Browser extension — fastest"}
                </p>
              </div>
              {connecting === injConnector.name ? (
                <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          )}

          {/* All wallets — Reown AppKit QR (client-side) */}
          {appkitEnabled ? (
            <AppKitWalletRow onClosed={() => onClose()} />
          ) : (
            <p className="text-center text-xs text-gray-400 py-2 px-3">
              Set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> (free at cloud.reown.com) to enable the mobile QR &amp; all wallets
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-center text-xs text-gray-400">
            Mobile? Scan the QR with your wallet app — connect &amp; pay in-app
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reown AppKit — "All wallets" row
// AppKit's QR is generated fully client-side (no backend), so a QR always
// appears even if the server / Supabase is having issues. Once a wallet is
// connected, wagmi drives the "Pay X USDT" direct-transfer flow.
// ─────────────────────────────────────────────────────────────────────────────
function AppKitWalletRow({ onClosed }: { onClosed: () => void }) {
  const { open }        = useAppKit();
  const { isConnected } = useAppKitAccount();
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (isConnected) onClosed();
  }, [isConnected, onClosed]);

  return (
    <button
      onClick={() => { setOpening(true); void open().finally(() => setOpening(false)); }}
      disabled={opening}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-blue-50 border border-blue-100 transition-colors text-left disabled:opacity-60"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5">
          <path d="M9.58 11.85c3.54-3.46 9.28-3.46 12.82 0l.43.42a.44.44 0 010 .63l-1.46 1.43a.23.23 0 01-.32 0l-.59-.57c-2.47-2.42-6.48-2.42-8.95 0l-.63.62a.23.23 0 01-.32 0L9.11 12.9a.44.44 0 010-.63l.47-.42zm15.83 2.95l1.3 1.27a.44.44 0 010 .63l-5.86 5.73a.46.46 0 01-.64 0l-4.16-4.07a.12.12 0 00-.16 0l-4.16 4.07a.46.46 0 01-.64 0L5.25 16.7a.44.44 0 010-.63l1.3-1.27a.46.46 0 01.64 0l4.16 4.07c.04.04.12.04.16 0l4.16-4.07a.46.46 0 01.64 0l4.16 4.07c.04.04.12.04.16 0l4.16-4.07a.46.46 0 01.64 0z" fill="white"/>
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">All wallets</p>
        <p className="text-xs text-gray-400">
          {opening ? "Opening…" : "QR · 400+ wallets (OKX, Binance, Trust, …)"}
        </p>
      </div>
      {opening ? (
        <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      ) : (
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}