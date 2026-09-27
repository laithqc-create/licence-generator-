/**
 * Generic TypeScript client for ANY product (Node bots, web apps,
 * desktop apps, backends, trading systems, etc.) to validate against
 * the /api/check-license endpoint.
 *
 * Usage:
 *   import { validateLicense, getMachineFingerprint } from "./validateLicense";
 *
 *   const res = await validateLicense({
 *     apiUrl: "https://your-domain.onrender.com/api/check-license",
 *     licenseKey: "TRD-XXXX-XXXX-XXXX-XXXX",
 *     deviceId: getMachineFingerprint(), // or any stable unique user/hardware ID
 *     productId: "my-product-id",         // optional
 *   });
 *
 *   if (!res.valid) {
 *     console.error("License invalid:", res.error);
 *     process.exit(1);
 *   }
 *   console.log("License active until", res.expiresAt);
 */

import crypto from "crypto";
import os from "os";

export interface ValidateLicenseParams {
  apiUrl: string;
  licenseKey: string;
  deviceId?: string;
  productId?: string;
  timeoutMs?: number;
}

export interface ValidateLicenseResult {
  valid: boolean;
  error?: string;
  expiresAt?: string;
  daysRemaining?: number;
  httpStatus: number;
}

/**
 * Returns a stable, privacy-preserving hardware/machine fingerprint
 * (survives reboots, changes on different machines).
 */
export function getMachineFingerprint(): string {
  const cpus = os.cpus().map((c) => c.model).join(",");
  const host = os.hostname();
  const user = os.userInfo().username;
  const net = JSON.stringify(os.networkInterfaces());
  const raw = `${host}|${user}|${cpus}|${net}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/**
 * Validates a license key with the central licensing server.
 */
export async function validateLicense(
  params: ValidateLicenseParams
): Promise<ValidateLicenseResult> {
  const { apiUrl, licenseKey, productId, timeoutMs = 10000 } = params;
  const deviceId = params.deviceId || getMachineFingerprint();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: licenseKey.trim().toUpperCase(),
        deviceId,
        ...(productId ? { productId } : {}),
      }),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      valid?: boolean;
      error?: string;
      expiresAt?: string;
      daysRemaining?: number;
    };

    if (res.ok && data.valid === true) {
      return {
        valid: true,
        expiresAt: data.expiresAt,
        daysRemaining: data.daysRemaining,
        httpStatus: res.status,
      };
    }

    return {
      valid: false,
      error: data.error || `Rejected (HTTP ${res.status})`,
      httpStatus: res.status,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return {
      valid: false,
      error: isTimeout
        ? "License server connection timed out"
        : `License check failed: ${err?.message || "network error"}`,
      httpStatus: 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}
