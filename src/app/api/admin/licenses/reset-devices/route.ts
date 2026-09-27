// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/licenses/reset-devices — clear the device lock on a license
// Body: { licenseKey }
// Protected by ADMIN_SECRET header. Used when a customer changes their PC /
// re-installs their terminal and is locked out by the max-devices quota.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { isValidLicenseFormat } from "@/lib/license-generator";
import { getSubscriptionByKey, resetLicenseDevices } from "@/lib/supabase-server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const { licenseKey } = body as Record<string, unknown>;
  if (typeof licenseKey !== "string" || !isValidLicenseFormat(licenseKey.trim())) {
    return NextResponse.json({ error: "A valid licenseKey is required." }, { status: 400 });
  }

  try {
    const sub = await getSubscriptionByKey(licenseKey.trim());
    if (!sub) {
      return NextResponse.json({ error: "License key not found." }, { status: 404 });
    }
    await resetLicenseDevices(sub.id);
    return NextResponse.json({ success: true, licenseKey: sub.license_key });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}