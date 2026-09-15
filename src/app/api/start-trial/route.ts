// ─────────────────────────────────────────────────────────────────────────────
// POST /api/start-trial — claim a one-time free trial for a product
// Request:  { productId, walletAddress }
// Response: { success, licenseKey, expiresAt, isNewUser: true, trialDays }
//
// Rules:
//   - Product must exist, be active, and have trial_days >= 1
//   - One trial per wallet per product (subscription token_used = 'TRIAL')
//   - Trial licenses are validated by /api/check-license like any paid one;
//     after expiry the user simply pays to renew the same subscription.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import {
  getProduct, getSubscriptionByWallet, createSubscription,
} from "@/lib/supabase-server";
import { generateLicenseKey } from "@/lib/license-generator";

function err(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON body."); }
  if (typeof body !== "object" || body === null)
    return err("Body must be a JSON object.");

  const { productId, walletAddress } = body as Record<string, unknown>;
  if (typeof productId !== "string" || !productId.trim())
    return err("productId is required.");
  if (typeof walletAddress !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress))
    return err("walletAddress must be a valid EVM address.");

  // 1. Product must exist, be active and offer a trial
  let product;
  try { product = await getProduct(productId.trim()); }
  catch (e) { return err(String(e), 500); }
  if (!product) return err("Product not found.", 404);

  const trialDays = Number(product.trial_days || 0);
  if (trialDays < 1) return err("This product does not offer a free trial.", 400);

  // 2. One trial per wallet per product
  try {
    const existing = await getSubscriptionByWallet(walletAddress.toLowerCase(), product.id);
    if (existing) {
      return err(
        existing.token_used === "TRIAL"
          ? "You have already claimed the free trial for this product."
          : "A license for this product already exists for this wallet.",
        409
      );
    }

    // 3. Issue the trial license
    const licenseKey = generateLicenseKey();
    const expiresAt  = new Date(Date.now() + trialDays * 86400_000).toISOString();
    const row = await createSubscription({
      wallet_address: walletAddress.toLowerCase(),
      license_key:    licenseKey,
      token_used:     "TRIAL",
      product_id:     product.id,
      expires_at:     expiresAt,
    });

    return NextResponse.json({
      success: true,
      licenseKey: row.license_key,
      expiresAt:  row.expires_at,
      isNewUser:  true,
      trialDays,
    }, { status: 201 });
  } catch (e) {
    return err(String(e), 500);
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}