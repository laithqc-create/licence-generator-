// ─────────────────────────────────────────────────────────────────────────────
// /api/verify-payment — verifies BSC tx, issues or renews a license
// Request: { txHash, walletAddress, productId }
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { isHex } from "viem";
import { verifyUsdtTransfer } from "@/lib/tx-verifier";
import { generateLicenseKey } from "@/lib/license-generator";
import {
  getProduct, getSubscriptionByWallet,
  createSubscription, renewSubscription,
} from "@/lib/supabase-server";
import type { VerifyPaymentResponse } from "@/types";

function isValidAddress(a: string) { return /^0x[0-9a-fA-F]{40}$/.test(a); }
function ok(data: Omit<Extract<VerifyPaymentResponse, { success: true }>, "success">) {
  return NextResponse.json({ success: true, ...data }, { status: 200 });
}
function err(error: string, status = 400) {
  return NextResponse.json({ success: false, error } satisfies Extract<VerifyPaymentResponse,{success:false}>, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON body."); }
  if (typeof body !== "object" || body === null) return err("Body must be JSON object.");

  const { txHash, walletAddress, productId } = body as Record<string, unknown>;

  if (typeof txHash !== "string" || !isHex(txHash) || txHash.length !== 66)
    return err("txHash must be a valid 32-byte hex string.");
  if (typeof walletAddress !== "string" || !isValidAddress(walletAddress))
    return err("walletAddress must be a valid EVM address.");
  if (typeof productId !== "string" || !productId.trim())
    return err("productId is required.");

  // 1. Load product — validates it exists and gets price/duration
  let product;
  try { product = await getProduct(productId.trim()); } catch (e) { return err(String(e), 500); }
  if (!product) return err(`Product "${productId}" not found.`, 404);

  // 2. Verify on-chain tx with product's exact price
  const requiredWei = BigInt(Math.round(product.price_usdt * 1e18));
  let verification;
  try {
    verification = await verifyUsdtTransfer(txHash as `0x${string}`, walletAddress, requiredWei);
  } catch (e) { return err(`Blockchain query failed: ${String(e)}`, 503); }

  if (!verification.valid) return err(verification.reason ?? "Transaction verification failed.", 402);

  // 3. New or returning user?
  let subscription;
  try { subscription = await getSubscriptionByWallet(walletAddress, productId); } catch (e) { return err(String(e), 500); }

  if (!subscription) {
    // New user
    const licenseKey = generateLicenseKey();
    const expiresAt  = new Date(Date.now() + product.duration_days * 86400_000).toISOString();
    try {
      const row = await createSubscription({
        wallet_address: walletAddress.toLowerCase(),
        license_key:    licenseKey,
        token_used:     "USDT-BEP20",
        product_id:     productId,
        expires_at:     expiresAt,
      });
      return ok({ licenseKey: row.license_key, expiresAt: row.expires_at, isNewUser: true,
        product: { name: product.name, price_usdt: product.price_usdt, duration_days: product.duration_days } });
    } catch (e) { return err(String(e), 500); }
  }

  // Returning user — renew
  try {
    const row = await renewSubscription(subscription.id, subscription.expires_at, product.duration_days);
    return ok({ licenseKey: row.license_key, expiresAt: row.expires_at, isNewUser: false,
      product: { name: product.name, price_usdt: product.price_usdt, duration_days: product.duration_days } });
  } catch (e) { return err(String(e), 500); }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
