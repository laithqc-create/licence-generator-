// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invoices/[id] — poll invoice status; detects the on-chain payment
//
// The buyer scans the QR with their wallet and approves the USDT transfer.
// Their wallet never connects to us, so we match the payment by scanning the
// USDT contract's Transfer logs addressed to the admin wallet and looking for
// the invoice's unique amount (base + random cent surcharge).
//
//   pending  → keep polling (payment not seen yet)
//   paid     → license issued/renewed, returns { licenseKey, expiresAt, txHash }
//   expired  → invoice past its 30 min TTL without payment → generate a new one
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import {
  getPaymentInvoice, markInvoicePaid, markInvoiceExpired,
  getProduct,
} from "@/lib/supabase-server";
import { findUsdtTransferToAdmin } from "@/lib/tx-verifier";
import { issueOrRenewLicense } from "@/lib/license-service";
import type { InvoiceStatusResponse } from "@/types";

const SCAN_BACK_BLOCKS = BigInt(200); // keep the RPC log window bounded (≈10 min)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id))
    return NextResponse.json({ success: false, error: "Invalid invoice id." } satisfies InvoiceStatusResponse, { status: 400 });

  let invoice;
  try { invoice = await getPaymentInvoice(id); }
  catch (e) {
    return NextResponse.json({ success: false, error: String(e) } satisfies InvoiceStatusResponse, { status: 500 });
  }
  if (!invoice)
    return NextResponse.json({ success: false, error: "Invoice not found." } satisfies InvoiceStatusResponse, { status: 404 });

  // Already paid → return the issued license immediately.
  if (invoice.status === "paid" && invoice.license_key && invoice.expires_at) {
    return NextResponse.json({
      success: true, status: "paid",
      txHash: invoice.tx_hash ?? undefined,
      licenseKey: invoice.license_key,
      expiresAt: invoice.expires_at,
    } satisfies InvoiceStatusResponse);
  }

  // Expired TTL → mark + tell the client to generate a fresh invoice/QR.
  if (invoice.status === "pending" && Date.now() > new Date(invoice.expires_invoices_at).getTime()) {
    try { await markInvoiceExpired(invoice.id); } catch { /* non-fatal */ }
    return NextResponse.json({ success: true, status: "expired" } satisfies InvoiceStatusResponse);
  }

  if (invoice.status !== "pending")
    return NextResponse.json({ success: true, status: invoice.status } satisfies InvoiceStatusResponse);

  // ── Pending: scan for a matching incoming transfer ─────────────────────────
  let latestBlock = 0n;
  try {
    const { createPublicClient, http } = await import("viem");
    const { bsc } = await import("viem/chains");
    const client = createPublicClient({
      chain: bsc,
      transport: http(process.env.BSC_RPC_URL ?? "https://rpc.ankr.com/bsc", { timeout: 10_000 }),
    });
    latestBlock = await client.getBlockNumber();
  } catch {
    return NextResponse.json({ success: true, status: "pending" } satisfies InvoiceStatusResponse);
  }

  const fromBlock = Math.max(BigInt(invoice.scan_from_block || 0), latestBlock - SCAN_BACK_BLOCKS);
  let matched = null;
  try {
    matched = await findUsdtTransferToAdmin(BigInt(invoice.amount_wei), fromBlock, latestBlock);
  } catch {
    return NextResponse.json({ success: true, status: "pending" } satisfies InvoiceStatusResponse);
  }

  if (!matched)
    return NextResponse.json({ success: true, status: "pending" } satisfies InvoiceStatusResponse);

  // ── Payment detected → issue / renew the license ───────────────────────────
  let product;
  try { product = await getProduct(invoice.product_id); } catch { /* fallthrough */ }
  if (!product)
    return NextResponse.json({ success: false, error: `Product for invoice not available.` } satisfies InvoiceStatusResponse, { status: 500 });

  try {
    const result = await issueOrRenewLicense(matched.sender, product);
    const walletLower = matched.sender.toLowerCase();
    try {
      await markInvoicePaid(invoice.id, {
        wallet_address: walletLower,
        tx_hash:        matched.txHash,
        license_key:    result.licenseKey,
        expires_at:     result.expiresAt,
      });
    } catch { /* already paid concurrently — result is still authoritative */ }

    return NextResponse.json({
      success: true, status: "paid",
      txHash: matched.txHash,
      licenseKey: result.licenseKey,
      expiresAt: result.expiresAt,
      isNewUser: result.isNewUser,
    } satisfies InvoiceStatusResponse);
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) } satisfies InvoiceStatusResponse, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}