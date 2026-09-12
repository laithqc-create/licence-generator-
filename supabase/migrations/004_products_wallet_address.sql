-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Per-product receiving USDT wallet
-- Run AFTER 003_payment_invoices.sql
--
-- Adds a wallet_address column to products. The admin sets this when creating
-- the product: it is the BEP-20 wallet that RECEIVES the USDT payments for that
-- product (used to build the scan-to-pay QR / EIP-681 URI and the direct
-- connected-wallet transfer). When NULL, the checkout falls back to the
-- NEXT_PUBLIC_ADMIN_WALLET_ADDRESS env var.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS wallet_address TEXT;

COMMENT ON COLUMN products.wallet_address IS
    'BEP-20 wallet that receives USDT for this product. Falls back to NEXT_PUBLIC_ADMIN_WALLET_ADDRESS when NULL.';