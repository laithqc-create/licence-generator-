// ─────────────────────────────────────────────────────────────────────────────
// On-Chain Transaction Verifier — server-side only
//
// Verifies that a wallet-connected USDT transfer on BSC actually happened:
// - receipt status = success
// - interacted with the USDT contract
// - a Transfer event sent the required amount to the product's receiving wallet
// - the sender is the provided wallet address
// ─────────────────────────────────────────────────────────────────────────────
import { createPublicClient, http, parseAbiItem, decodeEventLog, type Hex } from "viem";
import { bsc } from "viem/chains";

const TRANSFER_ABI = [
  parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
] as const;

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  senderAddress?: string;
}

export async function verifyUsdtTransfer(
  txHash: Hex,
  expectedSender: string,
  requiredWei: bigint, // passed from product.price_usdt — no hardcoded amount
  recipientWallet?: string, // per-product receiving wallet (falls back to env)
): Promise<VerificationResult> {
  const rpcUrl       = process.env.BSC_RPC_URL ?? "https://rpc.ankr.com/bsc";
  const adminWallet  = ((recipientWallet ?? "").trim() || (process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS ?? "").trim()) as Hex;
  const usdtContract = (process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS ?? "0x55d398326f99059fF775485246999027B3197955") as Hex;

  if (!adminWallet)
    return { valid: false, reason: "Server config error: admin wallet not set." };

  const client = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl, { timeout: 15_000, retryCount: 3, retryDelay: 1_000 }),
  });

  let receipt;
  try { receipt = await client.getTransactionReceipt({ hash: txHash }); }
  catch { return { valid: false, reason: "Transaction not found or not yet mined." }; }

  if (receipt.status !== "success")
    return { valid: false, reason: "Transaction failed on-chain." };

  if (receipt.to?.toLowerCase() !== usdtContract.toLowerCase())
    return { valid: false, reason: "Transaction did not interact with the USDT contract." };

  const usdtLogs = receipt.logs.filter(
    l => l.address.toLowerCase() === usdtContract.toLowerCase()
  );
  if (!usdtLogs.length)
    return { valid: false, reason: "No Transfer events found in transaction logs." };

  for (const log of usdtLogs) {
    try {
      const decoded = decodeEventLog({ abi: TRANSFER_ABI, data: log.data, topics: log.topics });
      const { from, to, value } = decoded.args;
      if (to.toLowerCase()   !== adminWallet.toLowerCase())    continue;
      if (value              <  requiredWei)
        return { valid: false, reason: `Insufficient payment: received ${value} wei, need ${requiredWei} wei.` };
      if (from.toLowerCase() !== expectedSender.toLowerCase())
        return { valid: false, reason: "Sender does not match provided wallet address." };
      return { valid: true, senderAddress: from };
    } catch { continue; }
  }

  return { valid: false, reason: "No valid Transfer to admin wallet found." };
}