// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invoices — create a scan-to-pay invoice (EIP-681 QR)
// Request:  { productId, priceUsdt }
// Response: { success, invoice, payUri, recipient, durationDays }
//
// Each invoice gets a UNIQUE amount (base price + 0.01..0.99 USDT surcharge).
// The frontend renders payUri as a QR; the wallet scans it, shows the exact
// amount and the admin wallet, and the buyer approves. The backend later
// matches the on-chain transfer by that unique amount (see GET /api/invoices/[id]).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getProduct, createPaymentInvoice, isAmountPending } from "@/lib/supabase-server";
import { buildPayUri, addUniqueSurcharge, toWei, weiToLabel } from "@/lib/eip681";
import type { CreateInvoiceResponse } from "@/types";

const DEFAULT_USDT = "0x55d398326f99059fF775485246999027B3197955";
const INVOICE_TTL_MS = 30 * 60 * 1000; // 30 minutes to pay

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." } satisfies CreateInvoiceResponse, { status: 400 });
  }
  if (typeof body !== "object" || body === null)
    return NextResponse.json({ success: false, error: "Body must be a JSON object." } satisfies CreateInvoiceResponse, { status: 400 });

  const { productId, priceUsdt } = body as Record<string, unknown>;
  if (typeof productId !== "string" || !productId.trim())
    return NextResponse.json({ success: false, error: "productId is required." } satisfies CreateInvoiceResponse, { status: 400 });
  if (typeof priceUsdt !== "number" || priceUsdt <= 0)
    return NextResponse.json({ success: false, error: "priceUsdt must be a positive number." } satisfies CreateInvoiceResponse, { status: 400 });

  // 1. Load product — defines the base price, duration, name.
  let product;
  try { product = await getProduct(productId.trim()); }
  catch (e) {
    return NextResponse.json({ success: false, error: String(e) } satisfies CreateInvoiceResponse, { status: 500 });
  }
  if (!product)
    return NextResponse.json({ success: false, error: `Product "${productId}" not found.` } satisfies CreateInvoiceResponse, { status: 404 });

  const adminWallet  = ((product.wallet_address ?? "").trim() || (process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS ?? "").trim());
  const usdtContract = (process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS ?? DEFAULT_USDT).trim();
  if (!adminWallet || !/^0x[0-9a-fA-F]{40}$/.test(adminWallet))
    return NextResponse.json({ success: false, error: "Server config error: ADMIN wallet address missing or invalid." } satisfies CreateInvoiceResponse, { status: 500 });

  const baseWei = toWei(product.price_usdt);

  // 2. Generate a unique amount (base + random cents). Guard against the
  //    extremely unlikely collision with another pending invoice.
  let amountWei = addUniqueSurcharge(baseWei);
  for (let i = 0; i < 30; i++) {
    try {
      if (!(await isAmountPending(amountWei.toString()))) break;
    } catch { /* DB hiccup — proceed, unique index still guards */ }
    amountWei = addUniqueSurcharge(baseWei);
  }

  const amountLabel = `${weiToLabel(amountWei)} USDT`;

  // 3. Store the pending invoice.
  let scanFromBlock = BigInt(0);
  try {
    const { createPublicClient, http } = await import("viem");
    const { bsc } = await import("viem/chains");
    const client = createPublicClient({
      chain: bsc,
      transport: http(process.env.BSC_RPC_URL ?? "https://rpc.ankr.com/bsc", { timeout: 10_000 }),
    });
    scanFromBlock = await client.getBlockNumber();
  } catch { /* block number is advisory — scanning uses a bounded recent window */ }

  let invoice;
  try {
    invoice = await createPaymentInvoice({
      product_id:   product.id,
      amount_wei:   amountWei.toString(),
      amount_label: amountLabel,
      scan_from_block: Number(scanFromBlock),
      recipient_wallet: adminWallet,
      expires_invoices_at: new Date(Date.now() + INVOICE_TTL_MS).toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: `Could not create invoice: ${String(e)}` } satisfies CreateInvoiceResponse, { status: 500 });
  }

  // 4. Build the scan-to-pay URI (QR payload).
  const payUri = buildPayUri(amountWei, adminWallet, { usdtContract, chainId: 56 });

  return NextResponse.json({
    success: true,
    invoice,
    payUri,
    recipient: adminWallet,
    durationDays: product.duration_days,
  } satisfies CreateInvoiceResponse);
}