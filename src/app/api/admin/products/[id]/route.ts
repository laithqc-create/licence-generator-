// /api/admin/products/[id] — GET one, PATCH update, DELETE soft-delete
import { NextRequest, NextResponse } from "next/server";
import { getProduct, upsertProduct, deleteProduct } from "@/lib/supabase-server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await params;

  const existing = await getProduct(id);
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const updated = await upsertProduct({
    ...existing,
    name:          (body.name         as string)  ?? existing.name,
    description:   (body.description  as string)  ?? existing.description,
    price_usdt:    (body.price_usdt   as number)  ?? existing.price_usdt,
    duration_days: (body.duration_days as number) ?? existing.duration_days,
    is_active:     body.is_active !== undefined ? (body.is_active as boolean) : existing.is_active,
    trial_days:    body.trial_days !== undefined
      ? (typeof body.trial_days === "number" && Number.isInteger(body.trial_days) && body.trial_days >= 0
          ? body.trial_days
          : existing.trial_days ?? 0)
      : existing.trial_days ?? 0,
    wallet_address: body.wallet_address !== undefined
      ? (typeof body.wallet_address === "string" && /^0x[0-9a-fA-F]{40}$/.test(body.wallet_address.trim())
          ? body.wallet_address.trim()
          : null)
      : existing.wallet_address ?? null,
  });
  return NextResponse.json({ product: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await params;
  await deleteProduct(id);
  return NextResponse.json({ success: true });
}
