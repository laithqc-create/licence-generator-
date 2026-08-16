// ─────────────────────────────────────────────────────────────────────────────
// /api/check-license — validates a license key, optionally checks productId
// Used by MT5 indicator and any external software
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { isValidLicenseFormat } from "@/lib/license-generator";
import { getSubscriptionByKey, deactivateSubscription } from "@/lib/supabase-server";
import type { CheckLicenseResponse } from "@/types";

function ok(data: Omit<Extract<CheckLicenseResponse,{valid:true}>,"valid">) {
  return NextResponse.json({ valid: true, ...data } satisfies CheckLicenseResponse, { status: 200 });
}
function deny(error: string, status = 403) {
  return NextResponse.json({ valid: false, error } satisfies CheckLicenseResponse, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return deny("Invalid JSON body.", 400); }
  if (typeof body !== "object" || body === null) return deny("Body must be JSON.", 400);

  const { licenseKey, productId } = body as Record<string, unknown>;

  if (typeof licenseKey !== "string" || !licenseKey.trim())
    return deny("licenseKey is required.", 400);
  if (!isValidLicenseFormat(licenseKey.trim()))
    return deny("License key format is invalid.", 400);

  let sub;
  try { sub = await getSubscriptionByKey(licenseKey.trim()); }
  catch (e) { return deny(String(e), 500); }

  if (!sub) return deny("License key not found.", 404);

  // Optional product check — if productId provided, must match
  if (productId && typeof productId === "string") {
    if (sub.product_id !== productId.trim())
      return deny("License key is not valid for this product.", 403);
  }

  // Server-side time comparison — cannot be spoofed by client
  if (Date.now() > new Date(sub.expires_at).getTime()) {
    if (sub.is_active) {
      try { await deactivateSubscription(sub.id); } catch { /* non-fatal */ }
    }
    return deny("Subscription has expired. Please renew.", 403);
  }

  return ok({
    message:   "License is active and valid.",
    expiresAt: sub.expires_at,
    productId: sub.product_id,
  });
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
