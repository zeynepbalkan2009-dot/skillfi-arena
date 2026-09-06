import { network } from "hardhat";

const ARC_TESTNET_CHAIN_ID = 5_042_002n;
const MAX_FEE_PER_GAS = 20n * 10n ** 9n;
const PRIORITY_FEE_PER_GAS = 1n * 10n ** 9n;

const { ethers } = await network.create();

async function main() {
  const escrowAddress = process.env.ARC_ESCROW_ADDRESS?.trim();
  const arbiterAddress = process.env.ARC_APP_ARBITER_ADDRESS?.trim();
  if (!escrowAddress || !ethers.isAddress(escrowAddress)) throw new Error("ARC_ESCROW_ADDRESS must be a valid address");
  if (!arbiterAddress || !ethers.isAddress(arbiterAddress) || arbiterAddress === ethers.ZeroAddress) {
    throw new Error("ARC_APP_ARBITER_ADDRESS must be a non-zero address");
  }

  const networkInfo = await ethers.provider.getNetwork();
  if (networkInfo.chainId !== ARC_TESTNET_CHAIN_ID) throw new Error(`Expected Arc Testnet chain ID ${ARC_TESTNET_CHAIN_ID}`);

  const [admin] = await ethers.getSigners();
  const escrow = await ethers.getContractAt("SkillFiEscrowV2", escrowAddress);
  const adminRole = await escrow.DEFAULT_ADMIN_ROLE();
  if (!(await escrow.hasRole(adminRole, admin.address))) {
    throw new Error(`Configured signer ${admin.address} does not hold DEFAULT_ADMIN_ROLE`);
  }

  const arbiterRole = await escrow.ARBITER_ROLE();
  if (await escrow.hasRole(arbiterRole, arbiterAddress)) {
    console.log("ARBITER_ROLE already present", { arbiterAddress });
    return;
  }

  const grantTx = await escrow.grantRole(arbiterRole, arbiterAddress, {
    maxFeePerGas: MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS,
  });
  const receipt = await grantTx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("ARBITER_ROLE grant transaction failed");
  if (!(await escrow.hasRole(arbiterRole, arbiterAddress))) throw new Error("ARBITER_ROLE verification failed after confirmation");
  console.log("Granted ARBITER_ROLE", { arbiterAddress, transactionHash: grantTx.hash });
}

await main();
