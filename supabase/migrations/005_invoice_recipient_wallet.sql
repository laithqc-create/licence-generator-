-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — Per-invoice recipient wallet (supports per-product wallets)
-- Run AFTER 004_products_wallet_address.sql
--
-- payment_invoices gains a recipient_wallet column: the BEP-20 address that is
-- expected to RECEIVE the USDT for this invoice (either the product's own
-- wallet_address or the global NEXT_PUBLIC_ADMIN_WALLET_ADDRESS fallback).
-- The on-chain scanner matches transfers to this exact address.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE payment_invoices
    ADD COLUMN IF NOT EXISTS recipient_wallet TEXT;

COMMENT ON COLUMN payment_invoices.recipient_wallet IS
    'BEP-20 wallet that must receive the USDT for this invoice (product wallet or global admin wallet).';