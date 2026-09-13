// ─────────────────────────────────────────────────────────────────────────────
// Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Product {
  id:             string;
  name:           string;
  description:    string;
  price_usdt:     number;
  duration_days:  number;
  is_active:      boolean;
  wallet_address: string | null; // BEP-20 wallet that receives USDT for this product (null → env fallback)
  created_at:     string;
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
  id:             string;
  name:           string;
  description:    string;
  price_usdt:     number;
  duration_days:  number;
  wallet_address?: string | null; // receiving BEP-20 wallet — blank defaults to env var
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
