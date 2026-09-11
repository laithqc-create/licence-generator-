"use client";
// ─────────────────────────────────────────────────────────────────────────────
// WalletModal — wallet picker for scan-to-pay
//
// Tapping a named wallet (OKX, Binance, MetaMask, Trust, …) opens the
// EIP-681 scan-to-pay QR — the buyer scans it with their wallet's own QR
// scanner and approves the USDT transfer. No WalletConnect pairing session.
//
// A browser-extension wallet (or WalletConnect, when a projectId is set) stays
// available as an "instant connect" fallback for power users.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useConnect } from "wagmi";

interface Props {
  onClose:      () => void;
  priceUsdt:    number;
  onPickWallet: (label: string) => void; // opens the scan-to-pay QR
}

const POPULAR = [
  { key: "okx",      label: "OKX Wallet",    emoji: "⭕", color: "#000" },
  { key: "metamask", label: "MetaMask",       emoji: "🦊", color: "#F6851B" },
  { key: "trust",    label: "Trust Wallet",   emoji: "🛡️", color: "#3375BB" },
  { key: "binance",  label: "Binance Web3",   emoji: "🟡", color: "#F0B90B" },
  { key: "coinbase", label: "Coinbase Wallet",emoji: "🔵", color: "#0052FF" },
  { key: "phantom",  label: "Phantom",        emoji: "👻", color: "#9945FF" },
];

export function WalletModal({ onClose, priceUsdt, onPickWallet }: Props) {
  const { connect, connectors, isPending } = useConnect();
  const [mounted, setMounted] = useState(false);
  const [search,  setSearch]  = useState("");
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  if (!mounted) return null;

  // Deduplicate connectors
  const unique = connectors.filter(
    (c, i, arr) => arr.findIndex(x => x.name === c.name) === i
  );

  const wcConnector  = unique.find(c => c.name.toLowerCase().includes("walletconnect"));
  const injConnector = unique.find(c => c.id === "injected" || c.name.toLowerCase().includes("injected"));

  // Direct connect — legacy instant flow (extension or WalletConnect session)
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

  // Scan-to-pay: any named wallet leads to the EIP-681 QR screen
  const handlePopular = (label: string) => onPickWallet(label);

  const filteredPopular = search
    ? POPULAR.filter(p => p.label.toLowerCase().includes(search.toLowerCase()))
    : POPULAR;

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
            <h2 className="text-base font-bold text-gray-900">Select wallet</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400">Choose your wallet — we'll show a QR code for it</p>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search wallets"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Wallet list */}
        <div className="px-3 pb-3 max-h-80 overflow-y-auto space-y-0.5">

          {/* Browser extension — instant connect when installed */}
          {injConnector && !search && (
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
                  {connecting === injConnector.name ? "Connecting…" : "Browser extension — pay in one click"}
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

          <div className="flex items-center gap-2 px-2 pt-0.5">
            <span className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] uppercase tracking-wider text-gray-400">Or scan to pay</span>
            <span className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Popular wallets — scan-to-pay (EIP-681 QR) */}
          {filteredPopular.map(w => (
            <button
              key={w.key}
              onClick={() => handlePopular(w.label)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: w.color + "15", border: `1px solid ${w.color}30` }}
              >
                {w.emoji}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{w.label}</p>
                <p className="text-xs text-gray-400">
                  Scan-to-pay · open in {w.label.split(" ")[0]}
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}

          {/* WalletConnect — all wallets QR */}
          {!search && wcConnector && (
                <button
                  onClick={() => handleConnect(wcConnector.id, "WalletConnect")}
                  disabled={!!connecting}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-blue-50 border border-blue-100 transition-colors text-left disabled:opacity-60 mt-1"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5">
                      <path d="M9.58 11.85c3.54-3.46 9.28-3.46 12.82 0l.43.42a.44.44 0 010 .63l-1.46 1.43a.23.23 0 01-.32 0l-.59-.57c-2.47-2.42-6.48-2.42-8.95 0l-.63.62a.23.23 0 01-.32 0L9.11 12.9a.44.44 0 010-.63l.47-.42zm15.83 2.95l1.3 1.27a.44.44 0 010 .63l-5.86 5.73a.46.46 0 01-.64 0l-4.16-4.07a.12.12 0 00-.16 0l-4.16 4.07a.46.46 0 01-.64 0L5.25 16.7a.44.44 0 010-.63l1.3-1.27a.46.46 0 01.64 0l4.16 4.07c.04.04.12.04.16 0l4.16-4.07a.46.46 0 01.64 0l4.16 4.07c.04.04.12.04.16 0l4.16-4.07a.46.46 0 01.64 0z" fill="white"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">WalletConnect</p>
                    <p className="text-xs text-gray-400">
                      {connecting === "WalletConnect" ? "Opening QR code…" : "400+ wallets via QR code"}
                    </p>
                  </div>
                  {connecting === "WalletConnect" ? (
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

              {/* No WC + no project ID notice */}
              {!wcConnector && !search && (
                <p className="text-center text-xs text-gray-400 py-2 px-3">
                  Enable <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> to also add WalletConnect instant-pay support
                </p>
              )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-center text-xs text-gray-400">
            Scan the QR with your wallet and approve the {priceUsdt}+ USDT transfer on BNB Smart Chain
          </p>
        </div>
      </div>
    </div>
  );
}
