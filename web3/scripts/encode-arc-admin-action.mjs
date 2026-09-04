import { Interface, getAddress, isAddress } from "ethers";

const action = process.argv[2]?.trim();
const allowedActions = new Map([
  ["enable-deposits", { functionName: "setDepositsEnabled", args: [true] }],
  ["disable-deposits", { functionName: "setDepositsEnabled", args: [false] }],
  ["pause", { functionName: "pause", args: [] }],
  ["unpause", { functionName: "unpause", args: [] }],
]);
const networks = new Map([
  ["arcTestnet", { chainId: 5_042_002 }],
  ["baseSepolia", { chainId: 84_532 }],
]);

if (!action || !allowedActions.has(action)) {
  console.error(
    "Usage: npm run admin:calldata -- <enable-deposits|disable-deposits|pause|unpause>"
  );
  process.exit(2);
}

const networkName = process.env.ADMIN_TARGET_NETWORK?.trim() || "arcTestnet";
const network = networks.get(networkName);
if (!network) {
  throw new Error("ADMIN_TARGET_NETWORK must be exactly arcTestnet or baseSepolia");
}

const targetRaw = (
  process.env.ESCROW_ADMIN_TARGET_ADDRESS?.trim()
  || (networkName === "arcTestnet" ? process.env.ARC_ESCROW_ADDRESS?.trim() : "")
);
if (targetRaw && !isAddress(targetRaw)) {
  throw new Error("ESCROW_ADMIN_TARGET_ADDRESS must be a valid EVM address when provided");
}

const iface = new Interface([
  "function setDepositsEnabled(bool _enabled)",
  "function pause()",
  "function unpause()",
]);
const selected = allowedActions.get(action);
const calldata = iface.encodeFunctionData(selected.functionName, selected.args);

const result = {
  network: networkName,
  chainId: network.chainId,
  target: targetRaw ? getAddress(targetRaw) : null,
  action,
  functionName: selected.functionName,
  args: selected.args,
  calldata,
  signsOrBroadcastsTransaction: false,
  note: "Submit this calldata through the configured DEFAULT_ADMIN_ROLE signer/multisig. Verify target, chain, current state, and simulation before execution.",
};

console.log(JSON.stringify(result, null, 2));
