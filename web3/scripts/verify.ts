import hre from "hardhat";

const escrowAddress = process.env.ESCROW_ADDRESS;
const tokenAddress = process.env.TOKEN_ADDRESS;
const adminAddress = process.env.ADMIN_ADDRESS;
const operatorAddress = process.env.OPERATOR_ADDRESS;
const arbiterAddress = process.env.ARBITER_ADDRESS;
const treasuryAddress = process.env.TREASURY_ADDRESS;
const feeBps = process.env.FEE_BPS;

if (!escrowAddress || !tokenAddress || !adminAddress || !operatorAddress || !arbiterAddress || !treasuryAddress || !feeBps) {
  throw new Error(
    "Missing ESCROW_ADDRESS, TOKEN_ADDRESS, ADMIN_ADDRESS, OPERATOR_ADDRESS, ARBITER_ADDRESS, TREASURY_ADDRESS, or FEE_BPS. Verification inputs must be explicit."
  );
}
if (!/^\d+$/.test(feeBps) || BigInt(feeBps) > 1_000n) {
  throw new Error("FEE_BPS must be an integer between 0 and 1000");
}

const normalized = [adminAddress, operatorAddress, arbiterAddress, treasuryAddress].map((value) => value.toLowerCase());
if (new Set(normalized).size !== normalized.length) {
  throw new Error("ADMIN_ADDRESS, OPERATOR_ADDRESS, ARBITER_ADDRESS, and TREASURY_ADDRESS must be distinct");
}

await hre.tasks.getTask("verify").run({
  address: escrowAddress,
  constructorArgs: [tokenAddress, adminAddress, operatorAddress, arbiterAddress, treasuryAddress, feeBps],
  contract: "contracts/SkillFiEscrowV3.sol:SkillFiEscrowV3",
});
