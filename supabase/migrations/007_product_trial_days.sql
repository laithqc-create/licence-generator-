-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Per-product free trial (days)
-- Run AFTER 006_product_hard_delete.sql (or after 002 on fresh databases)
--
-- Adds trial_days to products. 0 (default) = no trial.
-- One trial per wallet per product: claimed via POST /api/start-trial, stored
-- in trading_subscriptions with token_used = 'TRIAL'.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN products.trial_days IS
    'Free trial length in days (0 = no trial). One trial per wallet per product.';