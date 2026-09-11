// ─────────────────────────────────────────────────────────────────────────────
// EIP-681 payment URI builder — "scan-to-pay" QR payload
//
// Produces URIs in the form:
//   ethereum:<usdtContract>@<chainId>/transfer?address=<adminWallet>&uint256=<amountWei>
//
// ERC-20 / BEP-20 wallets that support EIP-681 (OKX, Trust Wallet, MetaMask
// mobile, Rabby, Frame…) parse this into an instant "send USDT" preview —
// the buyer just confirms. Wallets without EIP-681 support fall back to the
// copyable address + exact amount shown under the QR.
// ─────────────────────────────────────────────────────────────────────────────
import { getAddress } from "viem";

// BEP-20 USDT contract used when the env var is missing
const DEFAULT_USDT = "0x55d398326f99059fF775485246999027B3197955";

export interface PaymentUriOptions {
  usdtContract?: string;
  chainId?:      number;
}

export interface ParsedPaymentUri {
  contract: string;   // checksummed
  amountWei: bigint;
  label: string;      // e.g. "30.00 USDT"
}

/**
 * Converts a wei amount (string|bigint, 18 decimals) to a human label without
 * floating point: "30000000000000000000" → "30.00 USDT".
 */
export function weiToLabel(wei: bigint | string): string {
  const s = typeof wei === "bigint" ? wei.toString() : String(wei);
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  // pad to at least (len+1) so any price works, and slice the last 18 as cents
  const padded = digits.padStart(Math.max(digits.length + 1, 19), "0");
  const whole = padded.slice(0, -18).replace(/^0+/, "") || "0";
  const frac  = padded.slice(-18);
  // clamp to 6 decimals for display (per-client-base wei precision only matters
  // with a connected wagmi wallet; scan-to-pay matches on full wei server-side)
  const frac6 = frac.slice(0, 6);
  const label = `${neg ? "-" : ""}${whole}.${frac6}`;
  // trim trailing zeros
  return label.replace(/\.?0+$/, "");
}

/**
 * Parses a decimal USDT amount string ("30", "30.50") into wei (18 decimals)
 * using string math — no floating point rounding errors.
 */
export function labelToWei(amount: string): bigint {
  const s = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid amount: ${amount}`);
  const [whole, frac] = s.split(".");
  const fracPadded = (frac ?? "").padEnd(18, "0").slice(0, 18);
  return BigInt(`${whole}${fracPadded}`);
}

/**
 * Appends a small random cent surcharge (0.01 … 0.99 USDT) to the base price
 * so every invoice amount is globally unique. Returns the new wei amount.
 * The surcharge is shown to the buyer in the generated payUri/label.
 */
export function addUniqueSurcharge(baseWei: bigint): bigint {
  // 1..99 cents in wei (2 decimals worth of wei per cent)
  const cents = BigInt(1 + Math.floor(Math.random() * 99));
  return baseWei + cents * BigInt(10) ** BigInt(16);
}

/**
 * Builds the EIP-681 "ethereum:" URI. If the wallet is a plain address it is
 * reused as uri for QR as well.
 */
export function buildPayUri(
  amountWei: bigint,
  to: string,
  opts: PaymentUriOptions = {},
): string {
  const contract = (opts.usdtContract ?? process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS ?? DEFAULT_USDT).trim();
  const chainId  = opts.chainId ?? 56; // BNB Smart Chain
  const checksum = getAddress(to);
  const cChecksum = getAddress(contract);
  return `ethereum:${cChecksum}@${chainId}/transfer?address=${checksum}&uint256=${amountWei.toString()}`;
}

/** Parses an amount that may arrive as number|string into a BigInt wei. */
export function toWei(priceUsdt: number): bigint {
  return labelToWei(String(priceUsdt));
}