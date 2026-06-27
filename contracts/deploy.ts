import { ethers } from "hardhat";

async function main() {

  const deployer =
    (await ethers.getSigners())[0];

  console.log(
    "Deploying with:",
    deployer.address
  );

  const MockUSDC =
    await ethers.getContractFactory(
      "MockUSDC"
    );

  const usdc =
    await MockUSDC.deploy();

  await usdc.waitForDeployment();

  console.log(
    "MockUSDC:",
    await usdc.getAddress()
  );

  const Escrow =
    await ethers.getContractFactory(
      "SkillFiEscrowV2"
    );

  const escrow =
    await Escrow.deploy(
      await usdc.getAddress(),
      deployer.address,
      deployer.address,
      deployer.address,
      500
    );

  await escrow.waitForDeployment();

  console.log(
    "Escrow:",
    await escrow.getAddress()
  );
}

main().catch(console.error);