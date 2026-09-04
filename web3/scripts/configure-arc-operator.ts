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
  const verifyOnly = process.env.ARC_OPERATOR_VERIFY_ONLY === "1";
  const previousOperatorAddress = process.env.ARC_PREVIOUS_OPERATOR_ADDRESS?.trim()
    ? requiredAddress("ARC_PREVIOUS_OPERATOR_ADDRESS")
    : null;

  if (!verifyOnly && !previousOperatorAddress) {
    throw new Error("ARC_PREVIOUS_OPERATOR_ADDRESS is required for operator rotation; use ARC_OPERATOR_VERIFY_ONLY=1 only for read/verify configuration");
  }
  if (verifyOnly && previousOperatorAddress) {
    throw new Error("Do not set ARC_PREVIOUS_OPERATOR_ADDRESS in ARC_OPERATOR_VERIFY_ONLY mode");
  }
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
  const arbiterRole = await escrow.ARBITER_ROLE();
  const defaultAdminRole = await escrow.DEFAULT_ADMIN_ROLE();
  const treasury = await escrow.treasury();

  if (!(await escrow.hasRole(defaultAdminRole, admin.address))) {
    throw new Error(`Signer ${admin.address} does not hold DEFAULT_ADMIN_ROLE`);
  }
  if (operatorAddress.toLowerCase() === admin.address.toLowerCase()) {
    throw new Error("Application operator must not reuse the admin signer");
  }
  if (operatorAddress.toLowerCase() === treasury.toLowerCase()) {
    throw new Error("Application operator must not reuse the treasury address");
  }
  if (await escrow.hasRole(arbiterRole, operatorAddress)) {
    throw new Error("Application operator must not also hold ARBITER_ROLE");
  }

  const operatorAlreadyAuthorized = await escrow.hasRole(operatorRole, operatorAddress);
  if (verifyOnly) {
    if (!operatorAlreadyAuthorized) throw new Error("Verify-only operator does not hold OPERATOR_ROLE");
  } else {
    if (!operatorAlreadyAuthorized) {
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

    if (await escrow.hasRole(operatorRole, previousOperatorAddress!)) {
      const revokeTx = await escrow.revokeRole(operatorRole, previousOperatorAddress!, {
        maxFeePerGas: MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS,
      });
      await revokeTx.wait();
      console.log("Revoked previous OPERATOR_ROLE", {
        previousOperatorAddress,
        transactionHash: revokeTx.hash,
      });
    }

    if (await escrow.hasRole(operatorRole, previousOperatorAddress!)) {
      throw new Error("Previous operator still has OPERATOR_ROLE after rotation");
    }
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
    mode: verifyOnly ? "verify-only" : "rotation",
    operatorAddress,
    previousOperatorRevoked: previousOperatorAddress ? true : null,
    nativeGasBalance: finalBalance.toString(),
  });
}

await main();
