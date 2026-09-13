"use client";
import { useState } from "react";
import { useCheckoutFlow }  from "./useCheckoutFlow";
import { LicenseDisplay }   from "./LicenseDisplay";
import { StatusIndicator }  from "./StatusIndicator";
import { WalletModal }      from "./WalletModal";
import type { Product }     from "@/types";

interface Props { product: Product; }

export function CheckoutCard({ product }: Props) {
  const [showModal, setShowModal] = useState(false);
  const {
    state, setState, disconnect, executePurchase, reset,
    isConnected, isOnBsc, address,
  } = useCheckoutFlow(product);

  const isLoading = ["pending","confirming","verifying"].includes(state.step);
  const truncated = address ? `${address.slice(0,6)}…${address.slice(-4)}` : null;

  if (state.step === "success" && state.licenseKey && state.expiresAt) {
    return (
      <LicenseDisplay
        licenseKey={state.licenseKey}
        expiresAt={state.expiresAt}
        isNewUser={state.isNewUser ?? true}
        durationDays={product.duration_days}
        priceUsdt={product.price_usdt}
        txHash={state.txHash}
        onReset={reset}
      />
    );
  }

  return (
    <div className="space-y-5">
      {showModal && (
        <WalletModal
          priceUsdt={product.price_usdt}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Product summary */}
      <div className="flex items-center gap-4 rounded-xl border border-navy-700 bg-navy-900/60 p-5">
        <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white truncate">{product.name}</p>
          <p className="text-sm text-slate-400">{product.duration_days}-day subscription · BSC</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-white">{product.price_usdt} <span className="text-teal-400 text-lg">USDT</span></p>
          <p className="text-xs text-slate-500">BEP-20</p>
        </div>
      </div>

      {/* Wrong network */}
      {isConnected && !isOnBsc && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-amber-400">Switching to <strong>BNB Smart Chain</strong>…</p>
        </div>
      )}

      {/* Status steps — show pending/verifying during live payments */}
      {!["idle","connected","error"].includes(state.step) && (
        <StatusIndicator step={state.step} txHash={state.txHash} />
      )}

      {/* Error */}
      {state.step === "error" && state.errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex gap-3">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-400">Payment Failed</p>
            <p className="text-xs text-slate-400 mt-0.5 break-words">{state.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Connected wallet pill */}
      {isConnected && truncated && !isLoading && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-navy-700 bg-navy-900/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 text-sm">Connected:</span>
            <span className="text-white font-mono text-sm font-semibold">{truncated}</span>
          </div>
          <button onClick={() => disconnect()} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Disconnect</button>
        </div>
      )}

      {/* Primary CTA */}
      {!isConnected ? (
        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-base bg-teal-500 hover:bg-teal-400 active:scale-[0.98] text-navy-950 transition-all shadow-lg shadow-teal-500/25"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
          </svg>
          Choose Wallet &amp; Pay {product.price_usdt} USDT
        </button>
      ) : isLoading ? (
        <div className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-base bg-navy-800 text-slate-400 border border-navy-700 cursor-wait">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {state.step === "pending"    && "Approve in your wallet…"}
          {state.step === "confirming" && "Confirming on-chain…"}
          {state.step === "verifying"  && "Verifying payment…"}
        </div>
      ) : (
        <button
          onClick={state.step === "error" ? () => { reset(); setTimeout(executePurchase, 300); } : executePurchase}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-base bg-teal-500 hover:bg-teal-400 text-navy-950 transition-all shadow-lg shadow-teal-500/25"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {state.step === "error" ? "Retry Payment" : `Pay ${product.price_usdt} USDT`}
        </button>
      )}

      <div className="flex items-center justify-center gap-5 pt-1">
        {[["🔗","On-chain verified"],["🔒","Non-custodial"],["⚡","Instant activation"]].map(([icon,label]) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{icon}</span><span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
