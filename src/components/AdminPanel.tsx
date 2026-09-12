"use client";
// ─────────────────────────────────────────────────────────────────────────────
// AdminPanel — full product management UI
// Login with ADMIN_SECRET → create/edit products → copy checkout URLs
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import type { Product } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────
function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function useAdminApi(secret: string) {
  const headers = { "Content-Type": "application/json", "x-admin-secret": secret };

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    const res = await fetch("/api/admin/products", { headers: { "x-admin-secret": secret } });
    if (!res.ok) throw new Error("Unauthorized or server error");
    const data = await res.json();
    return data.products;
  }, [secret]);

  const saveProduct = useCallback(async (product: Omit<Product,"created_at">) => {
    const res = await fetch("/api/admin/products", {
      method: "POST", headers,
      body: JSON.stringify(product),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    return (await res.json()).product as Product;
  }, [secret]);

  const deleteProduct = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "DELETE", headers: { "x-admin-secret": secret },
    });
    if (!res.ok) throw new Error("Delete failed");
  }, [secret]);

  return { fetchProducts, saveProduct, deleteProduct };
}

// ── Empty form state ──────────────────────────────────────────────────────────
const EMPTY = { id: "", name: "", description: "", price_usdt: 30, duration_days: 30, is_active: true, wallet_address: "" };

// ── Main component ────────────────────────────────────────────────────────────
export function AdminPanel() {
  const [secret,   setSecret]   = useState("");
  const [authed,   setAuthed]   = useState(false);
  const [authErr,  setAuthErr]  = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [form,     setForm]     = useState({ ...EMPTY });
  const [editing,  setEditing]  = useState<string | null>(null);
  const [formErr,  setFormErr]  = useState("");
  const [saved,    setSaved]    = useState("");
  const [copied,   setCopied]   = useState<string | null>(null);

  const api = useAdminApi(secret);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.fetchProducts();
      setProducts(list);
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : "Auth failed");
      setAuthed(false);
    } finally { setLoading(false); }
  }, [api]);

  const login = async () => {
    setAuthErr("");
    setLoading(true);
    try {
      await api.fetchProducts().then(setProducts);
      setAuthed(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // fetchProducts throws "Unauthorized or server error" on any non-OK;
      // the API returns 401 for bad secret, 500 for server/supabase failure.
      if (msg.includes("Unauthorized")) {
        setAuthErr("Wrong secret. Check ADMIN_SECRET in Render env vars.");
      } else {
        setAuthErr("Server error — check Render logs (Supabase or config).");
      }
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setFormErr("");
    if (!form.name.trim())          return setFormErr("Name is required.");
    if (form.price_usdt <= 0)       return setFormErr("Price must be greater than 0.");
    if (form.duration_days < 1)     return setFormErr("Duration must be at least 1 day.");
    if (!form.id.trim())            return setFormErr("Product ID is required.");
    if (!/^[a-z0-9-]+$/.test(form.id)) return setFormErr("ID must be lowercase letters, numbers, and hyphens only.");
    const wallet = form.wallet_address.trim();
    if (wallet && !/^0x[0-9a-fA-F]{40}$/.test(wallet))
      return setFormErr("Receiving wallet must be a valid 0x address (0x + 40 hex chars).");

    setLoading(true);
    try {
      await api.saveProduct(form);
      await loadProducts();
      setForm({ ...EMPTY });
      setEditing(null);
      setSaved("Product saved!");
      setTimeout(() => setSaved(""), 3000);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Save failed.");
    } finally { setLoading(false); }
  };

  const handleEdit = (p: Product) => {
    setEditing(p.id);
    setForm({ id: p.id, name: p.name, description: p.description,
      price_usdt: p.price_usdt, duration_days: p.duration_days, is_active: p.is_active,
      wallet_address: p.wallet_address ?? "" });
    setFormErr("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Deactivate product "${id}"?`)) return;
    try { await api.deleteProduct(id); await loadProducts(); } catch { /**/ }
  };

  const copyUrl = async (id: string) => {
    const url = `${window.location.origin}/checkout/${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Login screen ─────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-navy-700 bg-navy-900 p-8 space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-xl font-bold text-white">Admin Login</h1>
            <p className="text-sm text-slate-400 mt-1">Enter your ADMIN_SECRET to continue</p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              className="w-full bg-navy-950 border border-navy-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-teal-500"
            />
            {authErr && <p className="text-xs text-red-400">{authErr}</p>}
            <button
              onClick={login}
              disabled={loading || !secret}
              className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 font-semibold text-sm transition-all disabled:opacity-50"
            >
              {loading ? "Checking…" : "Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {/* Header */}
      <div className="border-b border-navy-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">DecentraLicense Admin</h1>
          <p className="text-xs text-slate-500">Manage products and checkout URLs</p>
        </div>
        <button onClick={() => setAuthed(false)} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Logout</button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* ── Create / Edit form ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-navy-700 bg-navy-900 p-6 space-y-5">
          <h2 className="text-base font-bold text-white">
            {editing ? `Editing: ${editing}` : "Create New Product"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs text-slate-400">Product Name *</label>
              <input
                value={form.name}
                onChange={e => {
                  const name = e.target.value;
                  setForm(f => ({ ...f, name, id: editing ? f.id : toSlug(name) }));
                }}
                placeholder="Scalping Ribbon Pro"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Product ID (URL slug) *</label>
              <input
                value={form.id}
                onChange={e => setForm(f => ({ ...f, id: toSlug(e.target.value) }))}
                placeholder="scalping-ribbon-pro"
                disabled={!!editing}
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
              />
              {form.id && (
                <p className="text-xs text-slate-600">URL: /checkout/{form.id}</p>
              )}
            </div>

            {/* Price */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Price (USDT) *</label>
              <div className="relative">
                <input
                  type="number" min="1" step="0.01"
                  value={form.price_usdt}
                  onChange={e => setForm(f => ({ ...f, price_usdt: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-4 py-2.5 pr-16 text-white text-sm focus:outline-none focus:border-teal-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-teal-400 font-semibold">USDT</span>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Duration (days) *</label>
              <div className="relative">
                <input
                  type="number" min="1"
                  value={form.duration_days}
                  onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) || 1 }))}
                  className="w-full bg-navy-950 border border-navy-700 rounded-xl px-4 py-2.5 pr-16 text-white text-sm focus:outline-none focus:border-teal-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">days</span>
              </div>
            </div>

            {/* Description */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs text-slate-400">Description (optional)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short description shown on the checkout page"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Receiving USDT wallet */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs text-slate-400">
                Receiving USDT Wallet (BEP-20){" "}
                <span className="text-slate-600">— optional, defaults to the global admin wallet</span>
              </label>
              <input
                value={form.wallet_address}
                onChange={e => setForm(f => ({ ...f, wallet_address: e.target.value }))}
                placeholder="0x…"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-4 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
              />
              <p className="text-[11px] text-slate-600">
                USDT for this product is sent to this address. Leave blank to use NEXT_PUBLIC_ADMIN_WALLET_ADDRESS.
              </p>
            </div>
          </div>

          {formErr && <p className="text-xs text-red-400">{formErr}</p>}
          {saved   && <p className="text-xs text-emerald-400">{saved}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 font-semibold text-sm transition-all disabled:opacity-50"
            >
              {loading ? "Saving…" : editing ? "Update Product" : "Create Product"}
            </button>
            {editing && (
              <button
                onClick={() => { setEditing(null); setForm({ ...EMPTY }); setFormErr(""); }}
                className="px-5 py-3 rounded-xl border border-navy-700 text-slate-400 hover:text-white text-sm transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* ── Products list ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white">
            Products ({products.length})
          </h2>

          {products.length === 0 && !loading && (
            <div className="rounded-xl border border-navy-700 bg-navy-900/40 px-6 py-10 text-center text-slate-500 text-sm">
              No products yet — create one above
            </div>
          )}

          {products.map(p => (
            <div key={p.id} className="rounded-xl border border-navy-700 bg-navy-900/60 p-5">
              <div className="flex items-start gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{p.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mb-1">ID: {p.id}</p>
                  {p.description && <p className="text-xs text-slate-400 mb-2">{p.description}</p>}
                  {p.wallet_address && (
                    <p className="text-[11px] font-mono text-slate-500 mb-2 truncate" title={p.wallet_address}>
                      Receives: {p.wallet_address.slice(0, 10)}…{p.wallet_address.slice(-6)}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="text-teal-400 font-bold">{p.price_usdt} USDT</span>
                    <span>·</span>
                    <span>{p.duration_days} days</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => copyUrl(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${copied === p.id ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                        : "bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"}`}
                  >
                    {copied === p.id ? "✓ Copied!" : "📋 Copy URL"}
                  </button>
                  <button
                    onClick={() => handleEdit(p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-navy-600 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>

              {/* Checkout URL preview */}
              <div className="mt-3 flex items-center gap-2 bg-navy-950 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-600 flex-1 font-mono truncate">
                  {typeof window !== "undefined" ? window.location.origin : "https://your-domain.onrender.com"}/checkout/{p.id}
                </span>
                <button
                  onClick={() => copyUrl(p.id)}
                  className="text-xs text-teal-500 hover:text-teal-400 flex-shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
