// ─────────────────────────────────────────────────────────────────────────────
// Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Product {
  id:            string;
  name:          string;
  description:   string;
  price_usdt:    number;
  duration_days: number;
  is_active:     boolean;
  created_at:    string;
}

export interface Subscription {
  id:             string;
  wallet_address: string;
  license_key:    string;
  token_used:     string;
  product_id:     string | null;
  expires_at:     string;
  is_active:      boolean;
  created_at:     string;
}

// ── /api/verify-payment ───────────────────────────────────────────────────────
export interface VerifyPaymentRequest {
  txHash:        string;
  walletAddress: string;
  productId:     string;
}

export interface VerifyPaymentSuccess {
  success:    true;
  licenseKey: string;
  expiresAt:  string;
  isNewUser:  boolean;
  product:    Pick<Product, "name" | "price_usdt" | "duration_days">;
}

export interface VerifyPaymentError {
  success: false;
  error:   string;
}

export type VerifyPaymentResponse = VerifyPaymentSuccess | VerifyPaymentError;

// ── /api/check-license ────────────────────────────────────────────────────────
export interface CheckLicenseRequest {
  licenseKey: string;
  productId?: string; // optional — if provided, validates key belongs to this product
}

export interface CheckLicenseSuccess {
  valid:     true;
  message:   string;
  expiresAt: string;
  productId: string | null;
}

export interface CheckLicenseError {
  valid: false;
  error: string;
}

export type CheckLicenseResponse = CheckLicenseSuccess | CheckLicenseError;

// ── /api/admin/* ──────────────────────────────────────────────────────────────
export interface CreateProductRequest {
  id:           string;
  name:         string;
  description:  string;
  price_usdt:   number;
  duration_days: number;
}

// ── Frontend UI State ─────────────────────────────────────────────────────────
export type CheckoutStep =
  | "idle" | "connected" | "pending"
  | "confirming" | "verifying" | "success" | "error";

export interface CheckoutState {
  step:          CheckoutStep;
  txHash?:       string;
  licenseKey?:   string;
  expiresAt?:    string;
  isNewUser?:    boolean;
  errorMessage?: string;
}

// ── Scan-To-Pay (EIP-681 QR) ─────────────────────────────────────────────────
export interface PaymentInvoice {
  id:                 string;
  product_id:         string;
  amount_wei:         string;   // numeric string (safe for JS)
  amount_label:       string;   // e.g. "30.00 USDT"
  scan_from_block:    number;
  status:             "pending" | "paid" | "expired";
  wallet_address:     string | null;
  tx_hash:            string | null;
  license_key:        string | null;
  expires_at:         string | null;
  created_at:         string;
  expires_invoices_at: string;
}

export interface CreateInvoiceSuccess {
  success:  true;
  invoice:  PaymentInvoice;
  payUri:   string;   // ethereum:... EIP-681 URI — the QR payload
  recipient: string;  // admin wallet
  durationDays: number;
}

export interface CreateInvoiceError {
  success: false;
  error:   string;
}

export type CreateInvoiceResponse = CreateInvoiceSuccess | CreateInvoiceError;

// status: "pending" → keep polling; "paid" → license issued; "expired" → new QR
export interface InvoiceStatusSuccess {
  success: true;
  status:  "pending" | "paid" | "expired";
  txHash?: string;
  licenseKey?: string;
  expiresAt?: string;
  isNewUser?: boolean;
}

export interface InvoiceStatusError {
  success: false;
  error:   string;
}

export type InvoiceStatusResponse = InvoiceStatusSuccess | InvoiceStatusError;
