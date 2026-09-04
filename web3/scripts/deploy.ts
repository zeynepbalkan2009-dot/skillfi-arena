import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";

const BASE_SEPOLIA_CHAIN_ID = 84532n;
const { ethers } = await network.create();

function requiredAddress(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be explicitly set to a non-zero EVM address`);
  }
  return ethers.getAddress(value);
}

function feeFromEnv(): bigint {
  const raw = process.env.BASE_PLATFORM_FEE_BPS?.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error("BASE_PLATFORM_FEE_BPS must be explicitly set to an integer between 0 and 1000");
  }
  const fee = BigInt(raw);
  if (fee > 1_000n) throw new Error("BASE_PLATFORM_FEE_BPS cannot exceed 1000 (10%)");
  return fee;
}

function assertRoleSeparation(addresses: Record<string, string>, deployer: string) {
  const normalized = Object.entries({ deployer, ...addresses }).map(
    ([role, address]) => [role, address.toLowerCase()] as const,
  );
  const seen = new Map<string, string>();
  for (const [role, address] of normalized) {
    const previous = seen.get(address);
    if (previous) {
      throw new Error(`Refusing insecure deployment: ${role} and ${previous} share ${address}`);
    }
    seen.set(address, role);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();
  if (networkInfo.chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`Refusing to deploy: expected Base Sepolia chain ID ${BASE_SEPOLIA_CHAIN_ID}, received ${networkInfo.chainId}`);
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error(`Deployer ${deployer.address} has no Base Sepolia ETH for gas`);

  const operator = requiredAddress("BASE_OPERATOR_ADDRESS");
  const arbiter = requiredAddress("BASE_ARBITER_ADDRESS");
  const treasury = requiredAddress("BASE_TREASURY_ADDRESS");
  const platformFeeBps = feeFromEnv();
  assertRoleSeparation({ operator, arbiter, treasury }, deployer.address);

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const Escrow = await ethers.getContractFactory("SkillFiEscrowV3");
  const escrow = await Escrow.deploy(
    await usdc.getAddress(),
    operator,
    arbiter,
    treasury,
    platformFeeBps,
  );
  const deploymentTransaction = escrow.deploymentTransaction();
  await escrow.waitForDeployment();
  const receipt = deploymentTransaction ? await deploymentTransaction.wait() : null;

  const deployment = {
    contract: "SkillFiEscrowV3",
    network: "baseSepolia",
    chainId: Number(BASE_SEPOLIA_CHAIN_ID),
    escrow: await escrow.getAddress(),
    mockUsdc: await usdc.getAddress(),
    deployer: deployer.address,
    operator,
    arbiter,
    treasury,
    platformFeeBps: platformFeeBps.toString(),
    deploymentTxHash: deploymentTransaction?.hash ?? null,
    deploymentBlock: receipt?.blockNumber ?? null,
    deployedAt: new Date().toISOString(),
  };

  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const outputPath = resolve(scriptDirectory, "../deployments/base-sepolia-v3.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

  console.log("Base Sepolia V3 deployment complete", deployment);
}

await main();
