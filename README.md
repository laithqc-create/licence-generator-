# DecentraLicense

**Decentralized software licensing and subscription management on BNB Smart Chain.**

Zero centralized payment gateways. Zero geo-restrictions. Peer-to-peer USDT payments → on-chain verified → license key issued instantly.

---

## Architecture Overview

```
User Wallet
    │
    │  Reown AppKit wallet-connect QR (all wallets) or browser extension
    │  → wallet connects (mobile: app-to-app) → user approves the
    │    USDT (BEP-20) Transfer to the product's receiving wallet
    ▼
Wallet approves: 30 USDT → Admin/Product Wallet ◄── BNB Smart Chain (BSC)
    │
    │ txHash returned to UI
    ▼
POST /api/verify-payment { txHash, walletAddress, productId }
    │
    │ viem reads BSC via public RPC
    │ Validates: tx success + USDT contract + recipient + amount + sender
    ▼
Supabase (PostgreSQL)
New user → create + issue key (start = created_at, end = expires_at)
Returning → extend expiry + return key
    │
    ▼
License Key → UI → User


External App (MQL5/EA)
    │
    │  POST /api/check-license { licenseKey }
    ▼
Server compares Date.now() vs expires_at
    │
    ├─ Valid   → 200 OK
    └─ Expired → deactivate record → 403 Forbidden
```

---

## Tech Stack

| Layer | Technology | License |
|---|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS | MIT |
| Wallet Connect / QR | Reown AppKit (client-side QR, 400+ wallets) | Apache 2.0 |
| Wallet Hooks | Wagmi v2 + Viem v2 | MIT |
| Database | Supabase (PostgreSQL) | Apache 2.0 |
| Chain Reads | Viem public client (BSC RPC) | MIT |
| Key Generation | Node.js `crypto` (built-in) | — |
| Deployment | Render (Node service) | — |

**No Stripe. No Whop. No PayPal. No centralized gateway.**

---

## Prerequisites

- Node.js ≥ 22
- A [Reown Cloud](https://cloud.reown.com) account (free) → get a `projectId` (**required** for the mobile-wallet QR / all-wallets flow)
- A [Supabase](https://supabase.com) project (free tier works)
- An EVM wallet to receive payments (MetaMask, etc.)

---

## Setup

### 1. Clone & Install

```bash
git clone <your-repo>
cd decentra-license
npm install
```

### 2. Database — Run the SQL Migrations

1. Go to **Supabase Dashboard → SQL Editor → New Query**
2. Paste the contents of `supabase/migrations/001_trading_subscriptions.sql` → **Run**
3. Paste `supabase/migrations/002_products_and_admin.sql` → **Run**
4. Paste `supabase/migrations/004_products_wallet_address.sql` → **Run** (adds per-product receiving wallet)
5. Paste `supabase/migrations/006_product_hard_delete.sql` → **Run** (allows the admin Delete button to hard-delete products)
6. Verify: you should see `trading_subscriptions` and `products` in the Table Editor

> `003_payment_invoices.sql` and `005_invoice_recipient_wallet.sql` are **legacy** (the old scan-to-pay invoice flow was removed in favor of AppKit). They are harmless if already applied and can be skipped on fresh databases.

### 3. Environment Variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```env
# Reown AppKit / WalletConnect — powers the "All wallets" QR (client-side).
# Get projectId free at cloud.reown.com. Recommended: enables the mobile wallet QR.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Your wallet that receives payments (visible in frontend — safe)
# Optional now: every product can define its own receiving wallet in the admin
# panel ("Receiving USDT Wallet"). This env var is only the global fallback.
NEXT_PUBLIC_ADMIN_WALLET_ADDRESS=0xYourWalletHere

# BSC USDT contract (BEP-20) — correct as-is for mainnet
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955

# Supabase — use SERVICE ROLE key (not anon key)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Public BSC RPC — swap for a private node in production
BSC_RPC_URL=https://rpc.ankr.com/bsc

# 30 USDT in wei (18 decimals — BSC USDT)
SUBSCRIPTION_PRICE_WEI=30000000000000000000
```

### 4. Run Locally

```bash
npm run dev
# → http://localhost:3000/checkout
```

### 5. Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Set the same environment variables in **Vercel Dashboard → Project → Settings → Environment Variables**.

> **Important:** `SUPABASE_SERVICE_ROLE_KEY` should only be set in the **Server** scope — never expose it to the client.

---

## API Reference

### `POST /api/verify-payment`

Verifies an on-chain USDT payment and issues/renews a license.

**Request:**
```json
{
  "txHash": "0xabc123...",
  "walletAddress": "0xUserWallet..."
}
```

**Response 200:**
```json
{
  "success": true,
  "licenseKey": "TRD-A1B2-C3D4-E5F6-G7H8",
  "expiresAt": "2025-09-01T00:00:00.000Z",
  "isNewUser": true
}
```

**Response 402 (payment invalid):**
```json
{
  "success": false,
  "error": "Transaction sender does not match the provided wallet address."
}
```

---

### `POST /api/check-license`

Validates a license key from an external application (e.g., MQL5 EA).

**Request:**
```json
{
  "licenseKey": "TRD-A1B2-C3D4-E5F6-G7H8"
}
```

**Response 200:**
```json
{
  "valid": true,
  "message": "License is active and valid.",
  "expiresAt": "2025-09-01T00:00:00.000Z"
}
```

**Response 403 (expired):**
```json
{
  "valid": false,
  "error": "Subscription has expired. Please renew your subscription."
}
```

**Response 404 (not found):**
```json
{
  "valid": false,
  "error": "License key not found."
}
```

---

## MQL5 Integration Example

```mql5
// In your Expert Advisor's OnInit()
string license = "TRD-XXXX-XXXX-XXXX-XXXX"; // Load from file or input
string url = "https://your-domain.vercel.app/api/check-license";
string body = "{\"licenseKey\":\"" + license + "\"}";

char post[], result[];
string headers = "Content-Type: application/json\r\n";
ArrayResize(post, StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8) - 1);

int res = WebRequest("POST", url, headers, 5000, post, result, headers);

if (res == 200) {
    Print("License valid — EA running.");
} else if (res == 403) {
    Print("License expired — stopping EA.");
    ExpertRemove();
} else {
    Print("License check failed (HTTP ", res, ") — blocking EA.");
    ExpertRemove();
}
```

---

## Security Model

| Threat | Mitigation |
|---|---|
| Client submits fake txHash | viem queries BSC directly server-side; all validation is backend-only |
| Client tampers with system clock | All `expires_at` comparisons use `Date.now()` on the server |
| Anon key exposure | Supabase RLS blocks all anon/authenticated access; only service role (server-only) can read/write |
| Key format injection | Regex validation in `isValidLicenseFormat()` before any DB query |
| Replay attack (same txHash twice) | The DB `wallet_address` unique constraint prevents duplicate rows; second call extends expiry |
| Cross-checkout payment collision | Each scan-to-pay invoice uses a unique amount (base + random cents); a pending-amount unique index + exact wei match prevents one buyer's payment from licensing another's checkout |
| Wrong chain | `receipt.to` is checked against the exact USDT contract address |
| Wrong recipient | Transfer logs are filtered to verify `to === adminWallet` |
| Insufficient amount | `value >= REQUIRED_AMOUNT` checked in BigInt arithmetic |

---

## File Structure

```
decentra-license/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── verify-payment/route.ts   ← Contains connected-wallet licensing
│   │   │   ├── check-license/route.ts    ← Validates licenses
│   │   │   ├── invoices/route.ts         ← Creates scan-to-pay invoices (EIP-681 QR)
│   │   │   └── invoices/[id]/route.ts    ← Polls & detects the on-chain payment
│   │   ├── checkout/[productId]/page.tsx ← Checkout UI page
│   │   ├── layout.tsx                    ← Root layout + providers
│   │   ├── page.tsx                      ← Redirects → /checkout
│   │   └── globals.css
│   ├── components/
│   │   ├── AppProviders.tsx              ← Wagmi + QueryClient wrapper
│   │   ├── CheckoutCard.tsx              ← Main payment UI
│   │   ├── QrPaymentModal.tsx            ← Scan-to-Pay QR (EIP-681) flow
│   │   ├── WalletModal.tsx               ← Wallet picker → QR flow
│   │   ├── LicenseDisplay.tsx            ← License key + copy button
│   │   ├── StatusIndicator.tsx           ← Step progress tracker
│   │   └── useCheckoutFlow.ts            ← Payment state machine hook
│   ├── lib/
│   │   ├── wagmi-config.ts               ← Reown AppKit singleton
│   │   ├── eip681.ts                     ← Scan-to-pay URI builder (EIP-681)
│   │   ├── license-service.ts            ← Shared issue/renew license logic
│   │   ├── supabase-server.ts            ← DB client + typed helpers
│   │   ├── tx-verifier.ts                ← On-chain USDT verification
│   │   └── license-generator.ts          ← Crypto key generation
│   └── types/index.ts                    ← Shared TypeScript types
├── supabase/
│   └── migrations/
│       ├── 001_trading_subscriptions.sql ← Run this first
│       ├── 002_products_and_admin.sql    ← Products + admin
│       └── 003_payment_invoices.sql      ← Scan-to-pay invoices (EIP-681 QR)
├── .env.local.example                    ← Copy → .env.local
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## License

MIT — use freely in commercial projects.
