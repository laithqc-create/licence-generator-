// ─────────────────────────────────────────────────────────────────────────────
// License service — shared issue/renew logic used by
//   /api/verify-payment  (wallet-connected USDT transfer flow)
// ─────────────────────────────────────────────────────────────────────────────
import { generateLicenseKey } from "@/lib/license-generator";
import {
  getSubscriptionByWallet,
  createSubscription,
  renewSubscription,
} from "@/lib/supabase-server";
import type { Product } from "@/types";

export interface IssueResult {
  licenseKey: string;
  expiresAt:  string;
  isNewUser:  boolean;
}

/**
 * New wallet → generate + store a fresh license.
 * Known wallet → extend expiry from max(now, current expiry) + duration.
 */
export async function issueOrRenewLicense(
  walletAddress: string,
  product: Product,
): Promise<IssueResult> {
  const existing = await getSubscriptionByWallet(walletAddress.toLowerCase(), product.id);

  if (!existing) {
    const licenseKey = generateLicenseKey();
    const expiresAt  = new Date(Date.now() + product.duration_days * 86400_000).toISOString();
    try {
      const row = await createSubscription({
        wallet_address: walletAddress.toLowerCase(),
        license_key:    licenseKey,
        token_used:     "USDT-BEP20",
        product_id:     product.id,
        expires_at:     expiresAt,
        max_devices:    Math.max(0, product.max_devices ?? 2),
      });
      return { licenseKey: row.license_key, expiresAt: row.expires_at, isNewUser: true };
    } catch (e) {
      // Race: another request just created this wallet's subscription (unique per
      // wallet+product). Fall back to extending the existing license instead.
      if (String(e).includes("duplicate key")) {
        const raced = await getSubscriptionByWallet(walletAddress.toLowerCase(), product.id);
        if (raced) {
          const renewed = await renewSubscription(raced.id, raced.expires_at, product.duration_days);
          return { licenseKey: renewed.license_key, expiresAt: renewed.expires_at, isNewUser: false };
        }
      }
      throw e;
    }
  }

  const row = await renewSubscription(existing.id, existing.expires_at, product.duration_days);
  return { licenseKey: row.license_key, expiresAt: row.expires_at, isNewUser: false };
}