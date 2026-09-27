-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — Fix unique constraint: one subscription per wallet PER PRODUCT
-- Run AFTER 008 (or after 001 on fresh databases)
--
-- 001 created a unique index on wallet_address ALONE, so one wallet could
-- never own subscriptions for more than one product (any second purchase/trial
-- threw: duplicate key "idx_trading_subscriptions_wallet").
-- This drops that index and replaces it with (wallet, product_id), matching
-- how the app actually looks up + renews subscriptions.
-- ─────────────────────────────────────────────────────────────────────────────

-- Clean duplicates first: keep only the most recent row per (wallet, product)
DELETE FROM trading_subscriptions a
USING trading_subscriptions b
WHERE a.wallet_address ILIKE b.wallet_address
  AND a.product_id IS NOT DISTINCT FROM b.product_id
  AND a.created_at < b.created_at;

-- Replace the wallet-only unique index with a (wallet, product) one
DROP INDEX IF EXISTS idx_trading_subscriptions_wallet;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_subscriptions_wallet_product
    ON trading_subscriptions (LOWER(wallet_address), product_id);

COMMENT ON INDEX idx_trading_subscriptions_wallet_product IS
    'One subscription per wallet per product — allows multi-product purchases on one wallet.';