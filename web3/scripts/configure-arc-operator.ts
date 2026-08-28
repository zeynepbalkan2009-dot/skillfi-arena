import { network } from "hardhat";

const ARC_TESTNET_CHAIN_ID = 5_042_002n;
const OPERATOR_GAS_FUNDING = 2n * 10n ** 18n;
const MAX_FEE_PER_GAS = 20n * 10n ** 9n;
const PRIORITY_FEE_PER_GAS = 1n * 10n ** 9n;

const { ethers } = await network.create();

async function main() {
  const escrowAddress = process.env.ARC_ESCROW_ADDRESS?.trim();
  const operatorAddress = process.env.ARC_APP_OPERATOR_ADDRESS?.trim();
  if (!escrowAddress || !ethers.isAddress(escrowAddress)) throw new Error("ARC_ESCROW_ADDRESS must be a valid address");
  if (!operatorAddress || !ethers.isAddress(operatorAddress) || operatorAddress === ethers.ZeroAddress) throw new Error("ARC_APP_OPERATOR_ADDRESS must be a non-zero address");

  const networkInfo = await ethers.provider.getNetwork();
  if (networkInfo.chainId !== ARC_TESTNET_CHAIN_ID) throw new Error(`Expected Arc Testnet chain ID ${ARC_TESTNET_CHAIN_ID}`);

  const [admin] = await ethers.getSigners();
  const escrow = await ethers.getContractAt("SkillFiEscrowV2", escrowAddress);
  const operatorRole = await escrow.OPERATOR_ROLE();
  if (!(await escrow.hasRole(operatorRole, operatorAddress))) {
    const grantTx = await escrow.grantRole(operatorRole, operatorAddress, { maxFeePerGas: MAX_FEE_PER_GAS, maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS });
    await grantTx.wait();
    console.log("Granted OPERATOR_ROLE", { operatorAddress, transactionHash: grantTx.hash });
  } else {
    console.log("OPERATOR_ROLE already present", { operatorAddress });
  }

  const operatorBalance = await ethers.provider.getBalance(operatorAddress);
  if (operatorBalance < OPERATOR_GAS_FUNDING) {
    const amount = OPERATOR_GAS_FUNDING - operatorBalance;
    const fundTx = await admin.sendTransaction({ to: operatorAddress, value: amount, maxFeePerGas: MAX_FEE_PER_GAS, maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS });
    await fundTx.wait();
    console.log("Funded operator gas balance", { operatorAddress, amount: amount.toString(), transactionHash: fundTx.hash });
  } else {
    console.log("Operator gas balance already sufficient", { operatorAddress, balance: operatorBalance.toString() });
  }

  const finalRole = await escrow.hasRole(operatorRole, operatorAddress);
  const finalBalance = await ethers.provider.getBalance(operatorAddress);
  if (!finalRole || finalBalance < OPERATOR_GAS_FUNDING) throw new Error("Operator configuration verification failed");
  console.log("Arc application operator ready", { operatorAddress, nativeGasBalance: finalBalance.toString() });
}

await main();
