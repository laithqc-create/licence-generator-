// ─────────────────────────────────────────────────────────────────────────────
// Wagmi Config — injected wallets + WalletConnect v2
//
// injected()      → MetaMask, OKX, Binance Web3, Trust (browser extension)
// walletConnect() → Any mobile wallet via QR code (Trust, MetaMask Mobile, etc.)
//
// WalletConnect projectId is FREE at cloud.walletconnect.com
// No credit card. Limit: 100k monthly active users (plenty for this use case)
// ─────────────────────────────────────────────────────────────────────────────
import { createConfig, http } from "wagmi";
import { bsc }               from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors: [
    // Browser extension wallets (MetaMask, OKX, Binance Web3, Trust desktop)
    injected({ shimDisconnect: true }),
    // Mobile wallets via QR code — only added when projectId is provided
    ...(projectId
      ? [walletConnect({
          projectId,
          metadata: {
            name: "DecentraLicense",
            description: "Decentralized software licensing on BNB Smart Chain",
            url: typeof window !== "undefined" ? window.location.origin : "https://your-domain.onrender.com",
            icons: [],
          },
          showQrModal: true,
        })]
      : []
    ),
  ],
  transports: {
    [bsc.id]: http(
      process.env.NEXT_PUBLIC_BSC_RPC_URL ?? "https://rpc.ankr.com/bsc"
    ),
  },
  ssr: true,
});
