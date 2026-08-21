import "server-only";

import { baseSepolia } from "viem/chains";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ESCROW_CONTRACT_ADDRESS } from "@/lib/contracts";
import { skillFiEscrowAbi } from "@/lib/abi/skillFiEscrow";

function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

const rpcUrl = process.env.RPC_URL || undefined;
const operatorKey = requireEnv(process.env.OPERATOR_PRIVATE_KEY, "OPERATOR_PRIVATE_KEY") as `0x${string}`;

const operator = privateKeyToAccount(operatorKey);

export const escrowPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});

export const escrowWalletClient = createWalletClient({
  account: operator,
  chain: baseSepolia,
  transport: http(rpcUrl),
});

export const operatorAddress: Address = operator.address;

export { ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi };
