-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Hard-delete products + relax foreign keys
-- Run AFTER 002 (and optionally 003/004/005)
--
-- The admin "Delete" button now performs a real DELETE on products (instead of
-- a soft is_active=false). Without relaxing the FKs below, deleting a product
-- that has purchase rows would raise a foreign-key violation:
--   - trading_subscriptions.product_id  → ON DELETE SET NULL (keep license history)
--   - payment_invoices.product_id       → legacy table, → ON DELETE SET NULL
-- ─────────────────────────────────────────────────────────────────────────────

-- trading_subscriptions → keep rows, null out the product reference
ALTER TABLE trading_subscriptions
    DROP CONSTRAINT IF EXISTS trading_subscriptions_product_id_fkey;

ALTER TABLE trading_subscriptions
    ADD CONSTRAINT trading_subscriptions_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- payment_invoices is legacy (scan-to-pay flow removed). Only touch it if it exists.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payment_invoices'
    ) THEN
        ALTER TABLE payment_invoices
            DROP CONSTRAINT IF EXISTS payment_invoices_product_id_fkey;

        ALTER TABLE payment_invoices
            ALTER COLUMN product_id DROP NOT NULL;

        ALTER TABLE payment_invoices
            ADD CONSTRAINT payment_invoices_product_id_fkey
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN trading_subscriptions.product_id IS
    'Product this subscription belongs to. NULL when the product has been deleted.';