// ─────────────────────────────────────────────────────────────────────────────
// /api/check-license — validates a license key, optionally checks productId
// Registers the EA's device fingerprint and enforces the max-devices quota.
// Used by MT5 indicator and any external software
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { isValidLicenseFormat } from "@/lib/license-generator";
import {
  getSubscriptionByKey, deactivateSubscription,
  listLicenseDevices, upsertLicenseDevice,
} from "@/lib/supabase-server";
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

  const { licenseKey, productId, deviceId } = body as Record<string, unknown>;

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

  // ── Device lock: register / validate the EA fingerprint ─────────────────
  const maxDevices = sub.max_devices ?? 2;
  if (typeof deviceId !== "string" || deviceId.trim().length < 6) {
    return deny(
      "Device identifier required. Please use the latest version of the indicator.",
      403
    );
  }
  const device = deviceId.trim();
  try {
    const registered = await listLicenseDevices(sub.id);
    if (registered.includes(device)) {
      // Known device → refresh last-seen and allow (non-fatal if this fails)
      try { await upsertLicenseDevice(sub.id, device); } catch { /* non-fatal */ }
    } else if (registered.length >= maxDevices) {
      return deny(
        `This license is already activated on ${maxDevices} device(s). Please contact the seller to reset your devices.`,
        403
      );
    } else {
      await upsertLicenseDevice(sub.id, device);
    }
  } catch (e) {
    return deny(String(e), 500);
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
