"use client";
// ─────────────────────────────────────────────────────────────────────────────
// QrPaymentModal — Scan-To-Pay checkout (EIP-681)
//
// 1. POST /api/invoices creates a pending invoice with a UNIQUE amount
//    (base price + random cents) so the payment can be matched on-chain
//    without ever connecting the buyer's wallet.
// 2. Renders an EIP-681 "ethereum:" URI as a QR code. The buyer scans it
//    with their wallet's own QR scanner (OKX, Trust, MetaMask, Binance…),
//    reviews the amount + recipient and approves the USDT transfer.
// 3. Polls GET /api/invoices/[id] → when the transfer is seen on-chain the
//    server issues/extends the license and we reveal the key.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import qrcode from "qrcode";
import type { CreateInvoiceResponse, InvoiceStatusResponse, Product } from "@/types";

interface Props {
  product:     Product;
  walletLabel: string;
  onClose:     () => void;
  onSuccess:   (data: {
    licenseKey: string;
    expiresAt:  string;
    isNewUser:  boolean;
    txHash:     string;
  }) => void;
}

const POLL_MS = 4_000;

type Phase = "creating" | "qrcode" | "expired" | "paid" | "error";

interface InvoiceView {
  invoiceId:    string;
  payUri:       string;
  recipient:    string;
  amountLabel:  string;
  expiresAtMs:  number;
  durationDays: number;
}

function fmtCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function QrPaymentModal({ product, walletLabel, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>("creating");
  const [invoice, setInvoice]     = useState<InvoiceView | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [err, setErr]             = useState("");
  const [countdown, setCountdown] = useState(30 * 60);
  const [copied, setCopied]       = useState<"" | "uri" | "address">("");
  const [paid, setPaid]           = useState<{ licenseKey: string; expiresAt: string; isNewUser: boolean; txHash: string } | null>(null);

  // ── Create the invoice (once per mount / QR refresh) ───────────────────────
  const createInvoice = async () => {
    setPhase("creating");
    setErr("");
    setInvoice(null);
    setQrDataUrl(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, priceUsdt: product.price_usdt }),
      });
      const data: CreateInvoiceResponse = await res.json();
      if (!res.ok || !data.success) throw new Error(data.success === false ? data.error : `Server error ${res.status}`);

      const qr = qrcode.toDataURL(data.payUri, {
        width: 640, margin: 2,
        errorCorrectionLevel: "M" as const,
      });

      setInvoice({
        invoiceId:    data.invoice.id,
        payUri:       data.payUri,
        recipient:    data.recipient,
        amountLabel:  data.invoice.amount_label,
        expiresAtMs:  new Date(data.invoice.expires_invoices_at).getTime(),
        durationDays: data.durationDays,
      });
      setQrDataUrl(qr);
      setPhase("qrcode");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create payment request.");
      setPhase("error");
    }
  };

  useEffect(() => { void createInvoice(); /* eslint-disable-line */ }, [product.id]);

  // ── Countdown to invoice expiry ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "qrcode" || !invoice) return;
    const tick = () => setCountdown(Math.max(0, invoice.expiresAtMs - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, invoice]);

  // ── Poll for the on-chain payment ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "qrcode" || !invoice) return;
    let stop = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/invoices/${invoice.invoiceId}`);
        const data: InvoiceStatusResponse = await res.json();
        if (stop || !res.ok) return;
        if (data.success === false) { setErr(data.error); return; }

        if (data.status === "paid" && data.licenseKey && data.expiresAt) {
          setPaid({
            licenseKey: data.licenseKey,
            expiresAt:  data.expiresAt,
            isNewUser:  data.isNewUser ?? false,
            txHash:     data.txHash ?? "",
          });
          setPhase("paid");
        } else if (data.status === "expired") {
          setPhase("expired");
        }
      } catch { /* transient network error — poll again */ }
    };

    void poll();
    const t = setInterval(poll, POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, [phase, invoice, onSuccess]);

  // ── Copy helpers ────────────────────────────────────────────────────────────
  const copy = async (kind: "uri" | "address", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(""), 2000);
    } catch { /* ignore */ }
  };

  const back = () => { if (phase === "paid") return; onClose(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
      onClick={e => { if (e.target === e.currentTarget) back(); }}
      role="dialog" aria-modal="true"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-gray-900">
              {phase === "paid" ? "Payment received" : `Pay with ${walletLabel}`}
            </h2>
            <button
              onClick={back}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400">{phase === "paid" ? "License issued — see below" : product.name}</p>
        </div>

        <div className="px-5 py-4 space-y-4">

          {phase === "creating" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <svg className="w-8 h-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-sm text-gray-500">Preparing your payment request…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center space-y-2">
              <p className="text-sm font-semibold text-red-600">Could not create the payment request</p>
              <p className="text-xs text-red-400 break-words">{err}</p>
              <button
                onClick={() => void createInvoice()}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-sm text-white font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {phase === "expired" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center space-y-2">
              <p className="text-sm font-semibold text-amber-600">This payment request expired</p>
              <p className="text-xs text-amber-700">No transfer was detected within the 30 minute window. Generate a fresh QR code below — your payment details (recipient + amount) will be updated.</p>
              <button
                onClick={() => void createInvoice()}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-sm text-white font-medium"
              >
                ↻ Generate new QR code
              </button>
            </div>
          )}

          {phase === "qrcode" && invoice && qrDataUrl && (
            <>
              {/* QR */}
              <div className="flex flex-col items-center gap-3">
                <img
                  src={qrDataUrl}
                  alt="Scan to pay with your wallet"
                  width={208}
                  height={208}
                  referrerPolicy="no-referrer"
                  style={{ background: "#fff", imageRendering: "pixelated" } as React.CSSProperties}
                />
                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  Open <strong>{walletLabel}</strong> → tap <strong>Scan / Receive → Send</strong> and scan this QR.<br />
                  It pre-fills <strong>{invoice.amountLabel}</strong> USDT to our wallet. Approve the transfer.
                </p>
              </div>

              {/* Amount + recipient */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs text-gray-500"><strong>Amount</strong> · USDT (BEP-20)</span>
                <span className="text-sm font-bold text-gray-900">{invoice.amountLabel}</span>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500"><strong>Recipient</strong></span>
                  <button
                    onClick={() => void copy("address", invoice.recipient)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {copied === "address" ? "✓ Copied" : "Copy"}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-gray-600 break-all mt-1">{invoice.recipient}</p>
              </div>

              {/* Helpers */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">⏳ <strong className="text-gray-800">{fmtCountdown(countdown)}</strong> left</span>
                <button
                  onClick={() => void copy("uri", invoice.payUri)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {copied === "uri" ? "✓ Copied" : "Copy pay-link"}
                </button>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 flex gap-2">
                <span className="text-sm flex-shrink-0">ℹ️</span>
                <p className="text-[11px] text-gray-400 leading-relaxed flex-1">
                  Waiting for the transfer to appear on-chain — licensing happens automatically. If your wallet can't scan the QR, use the <strong>pay-link</strong> or send the amount manually to the recipient address above.
                </p>
              </div>
            </>
          )}

          {phase === "paid" && invoice && (
            <div className="space-y-0">
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex gap-3">
                <span className="text-2xl flex-shrink-0">✅</span>
                <div>
                  <p className="text-sm font-bold text-green-700">Payment verified on-chain</p>
                  <p className="text-xs text-green-700">{invoice.amountLabel} USDT received — your {invoice.durationDays}-day license is ready.</p>
                </div>
              </div>
              <button
                onClick={() => paid && onSuccess({
                  licenseKey: paid.licenseKey,
                  expiresAt:  paid.expiresAt,
                  isNewUser:  paid.isNewUser,
                  txHash:     paid.txHash,
                })}
                className="w-full py-3 rounded-xl bg-gray-900 text-sm text-white font-semibold mt-1"
              >
                View your license key →
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-center text-xs text-gray-400">
            {phase === "qrcode"
              ? "Keep this screen open — we'll detect the transfer automatically"
              : phase === "paid"
              ? "Tip: bookmark this page so you can find your license key later"
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}