// ─────────────────────────────────────────────────────────────────────────────
// On-Chain Transaction Verifier — server-side only
// requiredWei is now passed in dynamically from the product price
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

// ─────────────────────────────────────────────────────────────────────────────
// Scan-To-Pay scanner — find a confirmed USDT transfer matching an exact amount
//
// The buyer never connects a wallet session, so we cannot rely on a txHash or
// on the buyer's address. Instead each invoice carries a unique amount (base
// price + random cent surcharge). We scan recent Transfer logs of the USDT
// contract addressed to the admin wallet and look for an exact value match.
// ─────────────────────────────────────────────────────────────────────────────
export interface ScannedPayment {
  txHash:   `0x${string}`;
  sender:   `0x${string}`;
  blockNumber: bigint;
}

/**
 * Searches Transfer events of the USDT contract addressed to the admin wallet
 * within [fromBlock, toBlock]. Returns the first event whose value (wei) equals
 * exactly `amountWei`. Logs are decoded via viem's event filter which returns
 * plain args, so `value` arrives already as a bigint.
 */
export async function findUsdtTransferToAdmin(
  amountWei: bigint,
  fromBlock: bigint,
  toBlock: bigint,
  recipientWallet?: string, // per-product receiving wallet (falls back to env)
): Promise<ScannedPayment | null> {
  const rpcUrl       = process.env.BSC_RPC_URL ?? "https://rpc.ankr.com/bsc";
  const adminWallet  = ((recipientWallet ?? "").trim() || (process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS ?? "").trim()).toLowerCase();
  const usdtContract = (process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS ?? "0x55d398326f99059fF775485246999027B3197955").toLowerCase();

  if (!adminWallet)
    throw new Error("Server config error: admin wallet not set.");

  const client = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl, { timeout: 15_000, retryCount: 3, retryDelay: 1_000 }),
  });

  let logs;
  try {
    // event filter decodes logs for us; args scopes to Transfer(from,to) topics
    logs = await client.getLogs({
      address: usdtContract as Hex,
      event: TRANSFER_ABI[0],
      fromBlock,
      toBlock,
      strict: true,
    });
  } catch {
    return null; // RPC hiccup — callers treat as "still pending"
  }

  // Logs from getLogs are decoded; the typed shape we care about is
  // { transactionHash, blockNumber, args: { from, to, value } }.
  interface DecodedTransfer {
    transactionHash: `0x${string}`;
    blockNumber:     bigint;
    args:            { from: `0x${string}`; to: `0x${string}`; value: bigint };
  }
  const decodedLogs = (logs ?? []) as unknown as DecodedTransfer[];

  for (const log of decodedLogs) {
    try {
      if (String(log.args.to).toLowerCase() !== adminWallet) continue;
      if (log.args.value !== amountWei) continue; // exact unique amount
      return {
        txHash:      log.transactionHash,
        sender:      String(log.args.from).toLowerCase() as `0x${string}`,
        blockNumber: log.blockNumber,
      };
    } catch { continue; }
  }

  return null;
}
