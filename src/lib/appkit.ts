"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Reown AppKit — the modern wallet-connect QR layer (formerly WalletConnect)
//
// When NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set (free at cloud.reown.com),
// AppKit powers the "All wallets" QR in the wallet picker. Its QR is generated
// entirely client-side — no backend / Supabase dependency — which is what makes
// it reliable. Its WagmiAdapter becomes the app-wide wagmi config, so the
// existing "connect extension" flow and the direct USDT transfer flow still
// work on top of it.
//
// When the projectId is NOT set, everything gracefully falls back to the plain
// wagmi config in ./wagmi-config (injected extension only).
// ─────────────────────────────────────────────────────────────────────────────
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import { bsc, type AppKitNetwork } from "@reown/appkit/networks";
import { http } from "wagmi";

export const appkitProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "ce047f0e9edb979df81e960a5baae7c2";
export const appkitEnabled   = appkitProjectId.length > 0;

const networks = [bsc] as [AppKitNetwork, ...AppKitNetwork[]];

export const wagmiAdapter = appkitEnabled
  ? new WagmiAdapter({
      networks,
      projectId: appkitProjectId,
      transports: {
        [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_RPC_URL ?? "https://rpc.ankr.com/bsc"),
      },
      ssr: true,
    })
  : null;

// The wagmi config the whole app runs on when AppKit is enabled
export const appkitConfig = wagmiAdapter?.wagmiConfig ?? null;

// Creates the singleton modal — safe to call at module scope in a client module
// (same pattern as AppKit's own next-wagmi-app-router example).
export const appkitModal = appkitEnabled && wagmiAdapter
  ? createAppKit({
      adapters: [wagmiAdapter],
      networks,
      projectId: appkitProjectId,
      metadata: {
        name: "DecentraLicense",
        description: "Decentralized software licensing on BNB Smart Chain",
        url: typeof window !== "undefined" ? window.location.origin : "https://your-domain.onrender.com",
        icons: [],
      },
      themeMode: "dark",
    })
  : null;