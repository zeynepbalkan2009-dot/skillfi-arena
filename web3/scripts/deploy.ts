import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();
  if (networkInfo.chainId !== 84532n) {
    throw new Error(`Refusing to deploy: expected Base Sepolia chain ID 84532, received ${networkInfo.chainId}`);
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) {
    throw new Error(`Deployer ${deployer.address} has no Base Sepolia ETH for gas`);
  }

  console.log(
    "Deploying to Base Sepolia with:",
    deployer.address,
    `(balance: ${ethers.formatEther(balance)} ETH)`
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

await main();
