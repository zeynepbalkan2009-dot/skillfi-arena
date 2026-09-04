import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();
const MATCH_TIMEOUT = 30n * 60n;
const READY_GRACE = 10n * 60n;

async function increaseTime(seconds: bigint) {
  await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
  await ethers.provider.send("evm_mine", []);
}

async function fixture() {
  const [admin, operator, arbiter, treasury, player1, player2] = await ethers.getSigners();
  const token = await ethers.deployContract("MockUSDC");
  const escrow = await ethers.deployContract("SkillFiEscrowV3", [
    await token.getAddress(),
    operator.address,
    arbiter.address,
    treasury.address,
    500n,
  ]);
  const entryFee = ethers.parseUnits("10", 6);
  const float = ethers.parseUnits("100", 6);
  for (const player of [player1, player2]) {
    await token.mint(player.address, float);
    await token.connect(player).approve(await escrow.getAddress(), float);
  }
  return { admin, operator, arbiter, treasury, player1, player2, token, escrow, entryFee, float };
}

describe("SkillFiEscrowV3 security regressions", function () {
  it("rejects a late join after the waiting timeout", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(1n, f.entryFee);
    await increaseTime(MATCH_TIMEOUT + 1n);

    await expect(f.escrow.connect(f.player1).joinMatch(1n)).to.be.revertedWith("match expired");
  });

  it("measures active timeout from startedAt instead of createdAt", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(2n, f.entryFee);
    await increaseTime(MATCH_TIMEOUT - 60n);
    await f.escrow.connect(f.player1).joinMatch(2n);
    await f.escrow.connect(f.player2).joinMatch(2n);
    await f.escrow.connect(f.operator).startMatch(2n);

    await increaseTime(120n);
    await expect(f.escrow.reclaimActiveMatch(2n)).to.be.revertedWith("not expired");

    await increaseTime(MATCH_TIMEOUT);
    await expect(f.escrow.reclaimActiveMatch(2n)).not.to.be.reverted;
  });

  it("lets anyone refund a READY match if the operator never starts it", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(4n, f.entryFee);
    await f.escrow.connect(f.player1).joinMatch(4n);
    await f.escrow.connect(f.player2).joinMatch(4n);

    await expect(f.escrow.connect(f.player1).reclaimReadyMatch(4n)).to.be.revertedWith("not expired");
    await increaseTime(MATCH_TIMEOUT + READY_GRACE + 1n);
    await expect(f.escrow.connect(f.admin).reclaimReadyMatch(4n)).not.to.be.reverted;

    const match = await f.escrow.matches(4n);
    expect(match.status).to.equal(7n);
    expect(await f.token.balanceOf(f.player1.address)).to.equal(f.float);
    expect(await f.token.balanceOf(f.player2.address)).to.equal(f.float);
  });

  it("does not let the operator poison a nonexistent match id by cancelling it", async function () {
    const f = await fixture();
    await expect(f.escrow.connect(f.operator).cancelMatch(999n)).to.be.revertedWith("invalid state");
  });

  it("does not let the operator cancel a match after gameplay starts", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(5n, f.entryFee);
    await f.escrow.connect(f.player1).joinMatch(5n);
    await f.escrow.connect(f.player2).joinMatch(5n);
    await f.escrow.connect(f.operator).startMatch(5n);
    await expect(f.escrow.connect(f.operator).cancelMatch(5n)).to.be.revertedWith("invalid state");
  });

  it("stores the canonical winner on-chain", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(3n, f.entryFee);
    await f.escrow.connect(f.player1).joinMatch(3n);
    await f.escrow.connect(f.player2).joinMatch(3n);
    await f.escrow.connect(f.operator).startMatch(3n);
    await f.escrow.connect(f.operator).resolveMatch(3n, f.player2.address);

    const match = await f.escrow.matches(3n);
    expect(match.winner).to.equal(f.player2.address);
  });

  it("requires explicit non-zero operator and arbiter roles", async function () {
    const f = await fixture();
    const Escrow = await ethers.getContractFactory("SkillFiEscrowV3");
    await expect(
      Escrow.deploy(
        await f.token.getAddress(),
        ethers.ZeroAddress,
        f.arbiter.address,
        f.treasury.address,
        500n,
      ),
    ).to.be.revertedWith("invalid operator");
  });
});
