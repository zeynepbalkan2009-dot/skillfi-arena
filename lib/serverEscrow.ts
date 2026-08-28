import "server-only";

import { createPublicClient, createWalletClient, http, type Address, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ACTIVE_CHAIN, ACTIVE_RPC_URL, ESCROW_CONTRACT_ADDRESS } from "@/lib/contracts";
import { skillFiEscrowAbi } from "@/lib/abi/skillFiEscrow";

const activeChain: Chain = ACTIVE_CHAIN;
const rpcUrl = process.env.RPC_URL || ACTIVE_RPC_URL;

function getOperatorPrivateKey(): `0x${string}` {
  const rawKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!rawKey) {
    throw new Error("Missing OPERATOR_PRIVATE_KEY. Server-side escrow operations are disabled.");
  }

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("OPERATOR_PRIVATE_KEY must contain exactly 32 bytes.");
  }
  return key as `0x${string}`;
}

export const escrowPublicClient = createPublicClient({
  chain: activeChain,
  transport: http(rpcUrl),
});

export function getEscrowWalletClient() {
  const operator = privateKeyToAccount(getOperatorPrivateKey());
  return createWalletClient({
    account: operator,
    chain: activeChain,
    transport: http(rpcUrl),
  });
}

export function getOperatorAddress(): Address {
  return privateKeyToAccount(getOperatorPrivateKey()).address;
}

export { ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi };
