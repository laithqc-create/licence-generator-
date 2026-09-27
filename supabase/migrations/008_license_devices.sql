-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — Device lock (max activations per license)
-- Run AFTER 007 (or after 002 on fresh databases)
--
-- Path B policy:
--   - products / trading_subscriptions gain max_devices (default 2)
--   - license_devices stores the allowed device fingerprints per subscription
--   - /api/check-license registers the EA's deviceId on first use and rejects
--     new devices once the quota is full (admin can reset via the panel)
-- ─────────────────────────────────────────────────────────────────────────────

-- Device lock table (one row per authorized device per subscription)
CREATE TABLE IF NOT EXISTS license_devices (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id  UUID        NOT NULL REFERENCES trading_subscriptions(id) ON DELETE CASCADE,
    device_id        TEXT        NOT NULL,          -- hashed fingerprint from the EA
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, device_id)
);

-- Allowed number of devices per product (admin-configurable) and a snapshot
-- on each subscription (stable even if the product changes later)
ALTER TABLE products               ADD COLUMN IF NOT EXISTS max_devices INTEGER NOT NULL DEFAULT 2;
ALTER TABLE trading_subscriptions  ADD COLUMN IF NOT EXISTS max_devices INTEGER NOT NULL DEFAULT 2;

-- Index for finding which subscriptions a device fingerprint belongs to
CREATE INDEX IF NOT EXISTS idx_license_devices_device ON license_devices (device_id);

-- ── RLS (server-only like the other tables) ──────────────────────────────────
ALTER TABLE license_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access" ON license_devices
    FOR ALL
    TO anon, authenticated
    USING (FALSE);

COMMENT ON TABLE license_devices IS
    'Authorized device fingerprints per subscription (max_devices per subscription). Admin can reset.';
COMMENT ON COLUMN products.max_devices IS
    'How many devices a license for this product may activate (0/1..N). Default 2.';