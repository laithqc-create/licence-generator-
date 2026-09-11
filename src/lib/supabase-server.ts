// ─────────────────────────────────────────────────────────────────────────────
// Supabase Server Client — lazy init, server-side only
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Subscription, Product, PaymentInvoice } from "@/types";

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.");
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("products").select("*").eq("id", id).eq("is_active", true).maybeSingle();
  if (error) throw new Error(`[supabase] getProduct: ${error.message}`);
  return data;
}

export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("products").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`[supabase] getAllProducts: ${error.message}`);
  return data ?? [];
}

export async function upsertProduct(product: Omit<Product, "created_at">): Promise<Product> {
  const { data, error } = await getSupabaseAdmin()
    .from("products").upsert(product).select().single();
  if (error) throw new Error(`[supabase] upsertProduct: ${error.message}`);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("products").update({ is_active: false }).eq("id", id);
  if (error) throw new Error(`[supabase] deleteProduct: ${error.message}`);
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export async function getSubscriptionByWallet(wallet: string, productId: string): Promise<Subscription | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("trading_subscriptions").select("*")
    .ilike("wallet_address", wallet)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw new Error(`[supabase] getSubscriptionByWallet: ${error.message}`);
  return data;
}

export async function getSubscriptionByKey(licenseKey: string): Promise<Subscription | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("trading_subscriptions").select("*")
    .eq("license_key", licenseKey).maybeSingle();
  if (error) throw new Error(`[supabase] getSubscriptionByKey: ${error.message}`);
  return data;
}

export async function createSubscription(payload: {
  wallet_address: string;
  license_key:    string;
  token_used:     string;
  product_id:     string;
  expires_at:     string;
}): Promise<Subscription> {
  const { data, error } = await getSupabaseAdmin()
    .from("trading_subscriptions")
    .insert({ ...payload, is_active: true }).select().single();
  if (error) throw new Error(`[supabase] createSubscription: ${error.message}`);
  return data;
}

export async function renewSubscription(id: string, currentExpiresAt: string, durationDays: number): Promise<Subscription> {
  const base     = new Date(Math.max(Date.now(), new Date(currentExpiresAt).getTime()));
  const newExpiry = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const { data, error } = await getSupabaseAdmin()
    .from("trading_subscriptions")
    .update({ expires_at: newExpiry.toISOString(), is_active: true })
    .eq("id", id).select().single();
  if (error) throw new Error(`[supabase] renewSubscription: ${error.message}`);
  return data;
}

export async function deactivateSubscription(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("trading_subscriptions").update({ is_active: false }).eq("id", id);
  if (error) throw new Error(`[supabase] deactivateSubscription: ${error.message}`);
}

// ── Payment invoices (scan-to-pay) ───────────────────────────────────────────

export async function createPaymentInvoice(payload: {
  product_id:   string;
  amount_wei:   string;
  amount_label: string;
  scan_from_block: number;
  expires_invoices_at: string;
}): Promise<PaymentInvoice> {
  const { data, error } = await getSupabaseAdmin()
    .from("payment_invoices")
    .insert({ ...payload, status: "pending" }).select().single();
  if (error) throw new Error(`[supabase] createPaymentInvoice: ${error.message}`);
  return data;
}

export async function getPaymentInvoice(id: string): Promise<PaymentInvoice | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("payment_invoices").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`[supabase] getPaymentInvoice: ${error.message}`);
  return data;
}

export async function markInvoicePaid(id: string, fields: {
  wallet_address: string;
  tx_hash:        string;
  license_key:    string;
  expires_at:     string;
}): Promise<PaymentInvoice> {
  const { data, error } = await getSupabaseAdmin()
    .from("payment_invoices")
    .update({ status: "paid", ...fields }).eq("id", id).select().single();
  if (error) throw new Error(`[supabase] markInvoicePaid: ${error.message}`);
  return data;
}

export async function markInvoiceExpired(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("payment_invoices").update({ status: "expired" })
    .eq("id", id).eq("status", "pending");
  if (error) throw new Error(`[supabase] markInvoiceExpired: ${error.message}`);
}

export async function isAmountPending(amountWei: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("payment_invoices").select("id")
    .eq("amount_wei", amountWei).eq("status", "pending").maybeSingle();
  if (error) throw new Error(`[supabase] isAmountPending: ${error.message}`);
  return !!data;
}
