import { network } from "hardhat";

const ARC_TESTNET_CHAIN_ID = 5_042_002n;
const OPERATOR_GAS_FUNDING = 2n * 10n ** 18n;
const MAX_FEE_PER_GAS = 20n * 10n ** 9n;
const PRIORITY_FEE_PER_GAS = 1n * 10n ** 9n;

const { ethers } = await network.create();

function requiredAddress(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be a non-zero EVM address`);
  }
  return ethers.getAddress(value);
}

async function main() {
  const escrowAddress = requiredAddress("ARC_ESCROW_ADDRESS");
  const operatorAddress = requiredAddress("ARC_APP_OPERATOR_ADDRESS");
  const previousOperatorAddress = process.env.ARC_PREVIOUS_OPERATOR_ADDRESS?.trim()
    ? requiredAddress("ARC_PREVIOUS_OPERATOR_ADDRESS")
    : null;

  if (previousOperatorAddress && previousOperatorAddress.toLowerCase() === operatorAddress.toLowerCase()) {
    throw new Error("ARC_PREVIOUS_OPERATOR_ADDRESS must differ from ARC_APP_OPERATOR_ADDRESS");
  }

  const networkInfo = await ethers.provider.getNetwork();
  if (networkInfo.chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(`Expected Arc Testnet chain ID ${ARC_TESTNET_CHAIN_ID}`);
  }

  const [admin] = await ethers.getSigners();
  const escrow = await ethers.getContractAt("SkillFiEscrowV3", escrowAddress);
  const operatorRole = await escrow.OPERATOR_ROLE();

  if (!(await escrow.hasRole(operatorRole, operatorAddress))) {
    const grantTx = await escrow.grantRole(operatorRole, operatorAddress, {
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS,
    });
    await grantTx.wait();
    console.log("Granted OPERATOR_ROLE", { operatorAddress, transactionHash: grantTx.hash });
  }

  if (!(await escrow.hasRole(operatorRole, operatorAddress))) {
    throw new Error("New operator role verification failed; refusing to revoke the old operator");
  }

  if (previousOperatorAddress && (await escrow.hasRole(operatorRole, previousOperatorAddress))) {
    const revokeTx = await escrow.revokeRole(operatorRole, previousOperatorAddress, {
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS,
    });
    await revokeTx.wait();
    console.log("Revoked previous OPERATOR_ROLE", {
      previousOperatorAddress,
      transactionHash: revokeTx.hash,
    });
  }

  if (previousOperatorAddress && (await escrow.hasRole(operatorRole, previousOperatorAddress))) {
    throw new Error("Previous operator still has OPERATOR_ROLE after rotation");
  }

  const operatorBalance = await ethers.provider.getBalance(operatorAddress);
  if (operatorBalance < OPERATOR_GAS_FUNDING) {
    const amount = OPERATOR_GAS_FUNDING - operatorBalance;
    const fundTx = await admin.sendTransaction({
      to: operatorAddress,
      value: amount,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS,
    });
    await fundTx.wait();
    console.log("Funded operator gas balance", {
      operatorAddress,
      amount: amount.toString(),
      transactionHash: fundTx.hash,
    });
  }

  const finalBalance = await ethers.provider.getBalance(operatorAddress);
  if (!(await escrow.hasRole(operatorRole, operatorAddress)) || finalBalance < OPERATOR_GAS_FUNDING) {
    throw new Error("Operator configuration verification failed");
  }

  console.log("Arc application operator ready", {
    operatorAddress,
    previousOperatorRevoked: previousOperatorAddress ? true : null,
    nativeGasBalance: finalBalance.toString(),
  });
}

await main();
