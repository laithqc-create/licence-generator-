// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/products — GET all products, POST create/update
// Protected by ADMIN_SECRET header
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getAllProducts, upsertProduct } from "@/lib/supabase-server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const products = await getAllProducts();
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id, name, description, price_usdt, duration_days } = body;

  // Validate
  if (!id || typeof id !== "string" || !/^[a-z0-9-]+$/.test(id as string))
    return NextResponse.json({ error: "id must be lowercase letters, numbers and hyphens only" }, { status: 400 });
  if (!name || typeof name !== "string")
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (typeof price_usdt !== "number" || price_usdt <= 0)
    return NextResponse.json({ error: "price_usdt must be a positive number" }, { status: 400 });
  if (typeof duration_days !== "number" || duration_days < 1)
    return NextResponse.json({ error: "duration_days must be at least 1" }, { status: 400 });

  try {
    const product = await upsertProduct({
      id:           id as string,
      name:         name as string,
      description:  (description as string) ?? "",
      price_usdt:   price_usdt as number,
      duration_days: duration_days as number,
      is_active:    true,
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
