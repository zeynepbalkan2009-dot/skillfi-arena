import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";

const ARC_TESTNET_CHAIN_ID = 5_042_002n;
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const MIN_MAX_FEE_PER_GAS = 20n * 10n ** 9n;
const PRIORITY_FEE_PER_GAS = 1n * 10n ** 9n;

const { ethers } = await network.create();

function requiredAddress(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be explicitly set to a non-zero EVM address`);
  }
  return ethers.getAddress(value);
}

function feeFromEnv(): bigint {
  const raw = process.env.ARC_PLATFORM_FEE_BPS?.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error("ARC_PLATFORM_FEE_BPS must be explicitly set to an integer between 0 and 1000");
  }
  const fee = BigInt(raw);
  if (fee > 1_000n) throw new Error("ARC_PLATFORM_FEE_BPS cannot exceed 1000 (10%)");
  return fee;
}

function assertRoleSeparation(addresses: Record<string, string>, deployer: string) {
  const pairs = Object.entries({ deployer, ...addresses });
  const normalized = pairs.map(([role, address]) => [role, address.toLowerCase()] as const);
  const seen = new Map<string, string>();

  for (const [role, address] of normalized) {
    const existingRole = seen.get(address);
    if (existingRole) {
      throw new Error(
        `Refusing insecure deployment: ${role} and ${existingRole} resolve to the same address ${address}`
      );
    }
    seen.set(address, role);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();
  if (networkInfo.chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(`Refusing to deploy: expected Arc Testnet chain ID ${ARC_TESTNET_CHAIN_ID}, received ${networkInfo.chainId}`);
  }

  const nativeGasBalance = await ethers.provider.getBalance(deployer.address);
  if (nativeGasBalance === 0n) {
    throw new Error(`Deployer ${deployer.address} has no Arc Testnet USDC for gas`);
  }

  const operator = requiredAddress("ARC_OPERATOR_ADDRESS");
  const arbiter = requiredAddress("ARC_ARBITER_ADDRESS");
  const treasury = requiredAddress("ARC_TREASURY_ADDRESS");
  const platformFeeBps = feeFromEnv();

  assertRoleSeparation({ operator, arbiter, treasury }, deployer.address);

  const tokenCode = await ethers.provider.getCode(ARC_TESTNET_USDC);
  if (tokenCode === "0x") throw new Error(`No USDC contract code at ${ARC_TESTNET_USDC}`);

  console.log("Deploying SkillFiEscrowV3 to Arc Testnet", {
    deployer: deployer.address,
    operator,
    arbiter,
    treasury,
    platformFeeBps: platformFeeBps.toString(),
    usdc: ARC_TESTNET_USDC,
    nativeGasBalance: nativeGasBalance.toString(),
  });

  const Escrow = await ethers.getContractFactory("SkillFiEscrowV3");
  const escrow = await Escrow.deploy(
    ARC_TESTNET_USDC,
    operator,
    arbiter,
    treasury,
    platformFeeBps,
    { maxFeePerGas: MIN_MAX_FEE_PER_GAS, maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS }
  );
  const deploymentTransaction = escrow.deploymentTransaction();
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  const receipt = deploymentTransaction ? await deploymentTransaction.wait() : null;
  const runtimeCode = await ethers.provider.getCode(escrowAddress);
  if (runtimeCode === "0x") throw new Error("Escrow deployment returned no runtime bytecode");
  const [waitingTimeout, readyGrace, activeTimeout, disputeTimeout] = await Promise.all([
    escrow.matchTimeout(),
    escrow.readyMatchGrace(),
    escrow.activeMatchTimeout(),
    escrow.disputeTimeout(),
  ]);

  const deployment = {
    contract: "SkillFiEscrowV3",
    network: "arcTestnet",
    chainId: Number(ARC_TESTNET_CHAIN_ID),
    rpcUrl: "https://rpc.testnet.arc.network",
    explorerUrl: "https://testnet.arcscan.app",
    escrow: escrowAddress,
    usdc: ARC_TESTNET_USDC,
    deployer: deployer.address,
    operator,
    arbiter,
    treasury,
    platformFeeBps: platformFeeBps.toString(),
    waitingTimeout: waitingTimeout.toString(),
    readyGrace: readyGrace.toString(),
    activeTimeout: activeTimeout.toString(),
    disputeTimeout: disputeTimeout.toString(),
    runtimeCodeHash: ethers.keccak256(runtimeCode),
    deploymentTxHash: deploymentTransaction?.hash ?? null,
    deploymentBlock: receipt?.blockNumber ?? null,
    deployedAt: new Date().toISOString(),
  };

  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const outputPath = resolve(scriptDirectory, "../deployments/arc-testnet-v3.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

  console.log("Arc Testnet V3 deployment complete", deployment);
  console.log(`Explorer: https://testnet.arcscan.app/address/${escrowAddress}`);
}

await main();
