-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — Products table + admin secret + update subscriptions
-- Run AFTER 001_trading_subscriptions.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Products table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id            TEXT        PRIMARY KEY,        -- URL-safe slug e.g. "scalping-ribbon-pro"
    name          TEXT        NOT NULL,           -- Display name e.g. "Scalping Ribbon Pro"
    description   TEXT        NOT NULL DEFAULT '',
    price_usdt    NUMERIC(10,2) NOT NULL,         -- e.g. 30.00
    duration_days INTEGER     NOT NULL DEFAULT 30,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Add product_id to subscriptions ──────────────────────────────────────────
ALTER TABLE trading_subscriptions
    ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES products(id);

-- ── RLS on products (public read, no write from client) ───────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anyone can read active products (needed for checkout page to show price/name)
CREATE POLICY "Public can read active products" ON products
    FOR SELECT TO anon, authenticated
    USING (is_active = TRUE);

-- Only service role can insert/update/delete
CREATE POLICY "No client writes" ON products
    FOR ALL TO anon, authenticated
    USING (FALSE);

-- ── Seed one default product (edit price/name as needed) ─────────────────────
INSERT INTO products (id, name, description, price_usdt, duration_days)
VALUES (
    'scalping-ribbon-pro',
    'Scalping Ribbon Pro',
    'VIDYA ribbon indicator with 26 moving averages for MetaTrader 5',
    30.00,
    30
) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE products IS 'Products managed via admin panel. Each product gets its own checkout URL.';
COMMENT ON COLUMN products.id IS 'URL slug used in /checkout/[productId] and license validation.';
COMMENT ON COLUMN products.price_usdt IS 'Subscription price in USDT (18 decimal BEP-20).';
COMMENT ON COLUMN products.duration_days IS 'How many days the subscription lasts per payment.';
