// ─────────────────────────────────────────────────────────────────────────────
// /checkout/[productId] — dynamic checkout page per product
// e.g. /checkout/scalping-ribbon-pro
// ─────────────────────────────────────────────────────────────────────────────
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/supabase-server";
import { CheckoutCard } from "@/components/CheckoutCard";
import type { Product } from "@/types";

interface Props {
  params: Promise<{ productId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { productId } = await params;
  try {
    const product = await getProduct(productId);
    if (!product) return { title: "Product Not Found" };
    return { title: `Subscribe to ${product.name} — DecentraLicense` };
  } catch {
    return { title: "DecentraLicense" };
  }
}

export default async function ProductCheckoutPage({ params }: Props) {
  const { productId } = await params;

  let product: Product | null = null;
  try { product = await getProduct(productId); } catch { /* will show notFound */ }
  if (!product) notFound();

  return (
    <main className="min-h-screen bg-navy-950 flex flex-col items-center justify-center px-4 py-16"
      style={{
        backgroundImage:
          "linear-gradient(rgba(45,212,191,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(45,212,191,0.03) 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <div className="pointer-events-none fixed inset-0 opacity-40" style={{
        background: "radial-gradient(ellipse 60% 40% at 50% 0%,rgba(45,212,191,0.12),transparent)"
      }} />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Brand + product name */}
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-2 text-teal-400 text-xs font-mono tracking-widest uppercase border border-teal-500/30 bg-teal-500/5 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            BNB Smart Chain · {product.duration_days}-Day Subscription
          </span>
          <h1 className="text-3xl font-bold text-white tracking-tight">{product.name}</h1>
          {product.description && (
            <p className="text-sm text-slate-400 max-w-xs mx-auto">{product.description}</p>
          )}
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { n: "1", label: "Connect", desc: "Your wallet" },
            { n: "2", label: "Pay",     desc: `${product.price_usdt} USDT` },
            { n: "3", label: "Receive", desc: "License key" },
          ].map(s => (
            <div key={s.n} className="rounded-xl border border-navy-700 bg-navy-900/40 px-3 py-3">
              <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center mx-auto mb-1">{s.n}</div>
              <p className="text-xs font-semibold text-white">{s.label}</p>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Checkout card — receives product data as props */}
        <div className="relative rounded-2xl border border-navy-700 bg-navy-900/80 backdrop-blur-sm p-6 shadow-2xl shadow-black/50">
          <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
            style={{
              background: "linear-gradient(90deg,#2dd4bf,#0e2456,#fbbf24,#0e2456,#2dd4bf)",
              backgroundSize: "300%", animation: "bordermove 4s linear infinite",
            }}
          />
          <CheckoutCard product={product} />
        </div>

        {/* Renewal note */}
        <div className="rounded-xl border border-navy-800 bg-navy-900/30 px-4 py-3 flex gap-3">
          <span className="text-teal-400 text-lg flex-shrink-0">🔄</span>
          <div>
            <p className="text-xs font-semibold text-white">Renewal</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Reconnect the same wallet after expiry and pay again. Your license key is preserved — expiry extends by {product.duration_days} days.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600">
          Works with MetaMask · OKX Wallet · Trust Wallet · Binance Web3 · 300+ wallets via WalletConnect
        </p>
      </div>

      <style>{`@keyframes bordermove{0%{background-position:0%}100%{background-position:300%}}`}</style>
    </main>
  );
}
