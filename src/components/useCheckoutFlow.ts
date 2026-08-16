"use client";
// ─────────────────────────────────────────────────────────────────────────────
// useCheckoutFlow — Emergent-style payment state machine
//
// Flow: connect wallet → auto-trigger payment → QR/wallet popup → user approves
//       → tx confirmed → backend verifies → license key shown
//
// Renewal: same flow, wallet already connected → payment requested immediately
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect } from "react";
import {
  useAccount, useConnect, useDisconnect,
  useWriteContract, useWaitForTransactionReceipt, useSwitchChain,
} from "wagmi";
import { parseUnits, type Hex } from "viem";
import { bsc } from "wagmi/chains";
import type { CheckoutState, VerifyPaymentResponse, Product } from "@/types";

const ERC20_ABI = [{
  name: "transfer", type: "function", stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }],
}] as const;

const USDT_CONTRACT = (process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS
  ?? "0x55d398326f99059fF775485246999027B3197955") as Hex;
const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS ?? "") as Hex;

export function useCheckoutFlow(product: Product) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors }         = useConnect();
  const { disconnect }                  = useDisconnect();
  const { switchChain }                 = useSwitchChain();
  const { writeContractAsync }          = useWriteContract();

  const [state, setState]             = useState<CheckoutState>({ step: "idle" });
  const [pendingHash, setPendingHash] = useState<Hex | undefined>();
  const isOnBsc = chain?.id === bsc.id;

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: pendingHash,
    query: { enabled: !!pendingHash },
  });

  // Sync wallet connection into step
  useEffect(() => {
    setState(prev => {
      if (isConnected  && prev.step === "idle")       return { step: "connected" };
      if (!isConnected && prev.step === "connected")  return { step: "idle" };
      return prev;
    });
  }, [isConnected]);

  // Fire backend verify once tx is mined
  useEffect(() => {
    if (txConfirmed && pendingHash && state.step === "confirming")
      verifyWithBackend(pendingHash);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, pendingHash, state.step]);

  const connectWallet = useCallback((connectorId?: string) => {
    const target = connectorId
      ? connectors.find(c => c.id === connectorId)
      : connectors[0];
    if (target) connect({ connector: target });
  }, [connect, connectors]);

  const executePurchase = useCallback(async () => {
    if (!isConnected || !address) return;

    // Auto-switch to BSC if needed
    if (!isOnBsc) {
      try { await switchChain({ chainId: bsc.id }); }
      catch { /* user rejected switch — will retry */ }
      return;
    }

    if (!ADMIN_WALLET) {
      setState({ step: "error", errorMessage: "Admin wallet not configured." });
      return;
    }

    try {
      setState({ step: "pending" });
      // Amount is always driven by product.price_usdt — never hardcoded
      const amount = parseUnits(String(product.price_usdt), 18);
      const hash   = await writeContractAsync({
        address: USDT_CONTRACT,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [ADMIN_WALLET, amount],
        chainId: bsc.id,
      });
      setPendingHash(hash);
      setState({ step: "confirming", txHash: hash });
    } catch (e: unknown) {
      const msg      = e instanceof Error ? e.message : "Transaction rejected.";
      const rejected = /user rejected|user denied|cancelled/i.test(msg);
      // If rejected → go back to connected (not error) so they can retry easily
      setState({
        step: rejected ? "connected" : "error",
        errorMessage: rejected ? undefined : msg,
      });
    }
  }, [isConnected, address, isOnBsc, switchChain, writeContractAsync, product.price_usdt]);

  const verifyWithBackend = useCallback(async (hash: Hex) => {
    if (!address) return;
    setState({ step: "verifying", txHash: hash });
    try {
      const res  = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash, walletAddress: address, productId: product.id }),
      });
      const data: VerifyPaymentResponse = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.success === false ? data.error : `Server error ${res.status}`);
      setState({
        step: "success", txHash: hash,
        licenseKey: data.licenseKey,
        expiresAt:  data.expiresAt,
        isNewUser:  data.isNewUser,
      });
    } catch (e: unknown) {
      setState({ step: "error", txHash: hash,
        errorMessage: e instanceof Error ? e.message : "Verification failed." });
    }
  }, [address, product.id]);

  const reset = useCallback(() => {
    setState({ step: isConnected ? "connected" : "idle" });
    setPendingHash(undefined);
  }, [isConnected]);

  return {
    state, setState,
    connectWallet, disconnect,
    executePurchase, reset,
    isConnected, isOnBsc, address,
  };
}
