import hre from "hardhat";

const escrowAddress = process.env.ESCROW_ADDRESS;
const tokenAddress = process.env.TOKEN_ADDRESS;
const operatorAddress = process.env.OPERATOR_ADDRESS;
const arbiterAddress = process.env.ARBITER_ADDRESS;
const treasuryAddress = process.env.TREASURY_ADDRESS;
const feeBps = process.env.FEE_BPS ?? "500";

if (!escrowAddress || !tokenAddress || !operatorAddress || !arbiterAddress || !treasuryAddress) {
  throw new Error(
    "Missing ESCROW_ADDRESS, TOKEN_ADDRESS, OPERATOR_ADDRESS, ARBITER_ADDRESS, or TREASURY_ADDRESS."
  );
}

await hre.tasks.getTask("verify").run({
  address: escrowAddress,
  constructorArgs: [tokenAddress, operatorAddress, arbiterAddress, treasuryAddress, feeBps],
});
