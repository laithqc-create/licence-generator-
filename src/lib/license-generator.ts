// ─────────────────────────────────────────────────────────────────────────────
// DecentraLicense — Cryptographically Secure License Key Generator
//
// Uses Node.js built-in `crypto` module — zero third-party dependencies.
// Format: TRD-XXXX-XXXX-XXXX-XXXX  (uppercase hex segments)
// Entropy: 64 bits (4 × 16-bit segments) — suitable for subscription keys.
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes } from "crypto";

const PREFIX = "TRD";
const SEGMENT_BYTES = 2; // 2 bytes → 4 hex chars per segment
const NUM_SEGMENTS = 4;

/**
 * Generates a new license key in the format TRD-XXXX-XXXX-XXXX-XXXX.
 * Uses `crypto.randomBytes` for cryptographic randomness (CSPRNG).
 */
export function generateLicenseKey(): string {
  const segments: string[] = [];

  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const bytes = randomBytes(SEGMENT_BYTES);
    // Convert to uppercase hex, zero-padded to 4 characters
    segments.push(bytes.toString("hex").toUpperCase().padStart(4, "0"));
  }

  return `${PREFIX}-${segments.join("-")}`;
}

/**
 * Validates that a given string matches the expected license key format.
 * Used as a guard before DB queries in /api/check-license.
 */
export function isValidLicenseFormat(key: string): boolean {
  return /^TRD-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(key);
}
