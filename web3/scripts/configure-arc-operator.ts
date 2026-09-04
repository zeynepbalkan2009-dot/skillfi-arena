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

function requiredPrivateKey(name: string): string {
  const raw = process.env[name]?.trim();
  const key = raw?.startsWith("0x") ? raw : raw ? `0x${raw}` : "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`${name} must be a 32-byte hex private key`);
  }
  return key;
}

async function main() {
  const escrowAddress = requiredAddress("ARC_ESCROW_ADDRESS");
  const adminAddress = requiredAddress("ARC_ADMIN_ADDRESS");
  const operatorAddress = requiredAddress("ARC_APP_OPERATOR_ADDRESS");
  const verifyOnly = process.env.ARC_OPERATOR_VERIFY_ONLY === "1";
  const previousOperatorAddress = process.env.ARC_PREVIOUS_OPERATOR_ADDRESS?.trim()
    ? requiredAddress("ARC_PREVIOUS_OPERATOR_ADDRESS")
    : null;

  if (!verifyOnly && !previousOperatorAddress) {
    throw new Error("ARC_PREVIOUS_OPERATOR_ADDRESS is required for operator rotation; use ARC_OPERATOR_VERIFY_ONLY=1 only for read-only verification");
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

  const [funder] = await ethers.getSigners();
  const readEscrow = await ethers.getContractAt("SkillFiEscrowV3", escrowAddress);
  const operatorRole = await readEscrow.OPERATOR_ROLE();
  const arbiterRole = await readEscrow.ARBITER_ROLE();
  const defaultAdminRole = await readEscrow.DEFAULT_ADMIN_ROLE();
  const treasury = await readEscrow.treasury();

  if (!(await readEscrow.hasRole(defaultAdminRole, adminAddress))) {
    throw new Error(`Configured admin ${adminAddress} does not hold DEFAULT_ADMIN_ROLE`);
  }
  if (operatorAddress.toLowerCase() === adminAddress.toLowerCase()) {
    throw new Error("Application operator must not reuse the admin identity");
  }
  if (operatorAddress.toLowerCase() === treasury.toLowerCase()) {
    throw new Error("Application operator must not reuse the treasury address");
  }
  if (await readEscrow.hasRole(arbiterRole, operatorAddress)) {
    throw new Error("Application operator must not also hold ARBITER_ROLE");
  }

  const operatorAlreadyAuthorized = await readEscrow.hasRole(operatorRole, operatorAddress);
  if (verifyOnly) {
    if (!operatorAlreadyAuthorized) throw new Error("Verify-only operator does not hold OPERATOR_ROLE");
  } else {
    const adminWallet = new ethers.Wallet(requiredPrivateKey("ARC_ADMIN_PRIVATE_KEY"), ethers.provider);
    if (adminWallet.address.toLowerCase() !== adminAddress.toLowerCase()) {
      throw new Error("ARC_ADMIN_PRIVATE_KEY does not match ARC_ADMIN_ADDRESS");
    }
    const escrow = readEscrow.connect(adminWallet) as typeof readEscrow;

    if (!operatorAlreadyAuthorized) {
      const grantTx = await escrow.grantRole(operatorRole, operatorAddress, {
        maxFeePerGas: MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS,
      });
      await grantTx.wait();
      console.log("Granted OPERATOR_ROLE", { operatorAddress, transactionHash: grantTx.hash });
    }

    if (!(await readEscrow.hasRole(operatorRole, operatorAddress))) {
      throw new Error("New operator role verification failed; refusing to revoke the old operator");
    }

    if (await readEscrow.hasRole(operatorRole, previousOperatorAddress!)) {
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

    if (await readEscrow.hasRole(operatorRole, previousOperatorAddress!)) {
      throw new Error("Previous operator still has OPERATOR_ROLE after rotation");
    }

    const operatorBalance = await ethers.provider.getBalance(operatorAddress);
    if (operatorBalance < OPERATOR_GAS_FUNDING) {
      const funderBalance = await ethers.provider.getBalance(funder.address);
      const amount = OPERATOR_GAS_FUNDING - operatorBalance;
      if (funderBalance <= amount) {
        throw new Error(`Funder ${funder.address} does not have enough native balance to fund the operator`);
      }
      const fundTx = await funder.sendTransaction({
        to: operatorAddress,
        value: amount,
        maxFeePerGas: MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS,
      });
      await fundTx.wait();
      console.log("Funded operator gas balance", {
        funder: funder.address,
        operatorAddress,
        amount: amount.toString(),
        transactionHash: fundTx.hash,
      });
    }
  }

  const finalBalance = await ethers.provider.getBalance(operatorAddress);
  if (!(await readEscrow.hasRole(operatorRole, operatorAddress)) || finalBalance < OPERATOR_GAS_FUNDING) {
    throw new Error("Operator configuration verification failed");
  }

  console.log("Arc application operator ready", {
    mode: verifyOnly ? "verify-only" : "rotation",
    adminAddress,
    operatorAddress,
    previousOperatorRevoked: previousOperatorAddress ? true : null,
    nativeGasBalance: finalBalance.toString(),
  });
}

await main();
