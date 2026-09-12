"use client";
import React, { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi-config";
import { appkitConfig } from "@/lib/appkit";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
  }));

  // When a WalletConnect/Reown projectId is configured, AppKit owns the wagmi
  // config (adds its connectors + the client-side QR). Otherwise fall back to
  // the plain config (injected extension only).
  const config = appkitConfig ?? wagmiConfig;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
