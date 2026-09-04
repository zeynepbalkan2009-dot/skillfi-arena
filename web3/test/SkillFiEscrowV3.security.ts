import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();
const MATCH_TIMEOUT = 30n * 60n;
const READY_GRACE = 10n * 60n;
const DISPUTE_TIMEOUT = 7n * 24n * 60n * 60n;

async function increaseTime(seconds: bigint) {
  await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
  await ethers.provider.send("evm_mine", []);
}

async function fixture() {
  const [deployer, admin, operator, arbiter, treasury, player1, player2, newOperator, newTreasury] = await ethers.getSigners();
  const token = await ethers.deployContract("MockUSDC");
  const escrow = await ethers.deployContract("SkillFiEscrowV3", [
    await token.getAddress(),
    admin.address,
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
  return {
    deployer,
    admin,
    operator,
    arbiter,
    treasury,
    player1,
    player2,
    newOperator,
    newTreasury,
    token,
    escrow,
    entryFee,
    float,
  };
}

async function startFundedMatch(f: Awaited<ReturnType<typeof fixture>>, matchId: bigint) {
  await f.escrow.connect(f.operator).createMatch(matchId, f.entryFee, f.player1.address);
  await f.escrow.connect(f.player1).joinMatch(matchId);
  await f.escrow.connect(f.player2).joinMatch(matchId);
  await f.escrow.connect(f.operator).startMatch(matchId);
}

describe("SkillFiEscrowV3 security regressions", function () {
  it("binds player1 at creation and rejects a third-party first-join front-run", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(10n, f.entryFee, f.player1.address);
    await expect(f.escrow.connect(f.player2).joinMatch(10n)).to.be.revertedWith("not creator");
    const beforeCreatorJoin = await f.escrow.matches(10n);
    expect(beforeCreatorJoin.player1).to.equal(f.player1.address);
    expect(beforeCreatorJoin.player1Deposited).to.equal(false);
    await f.escrow.connect(f.player1).joinMatch(10n);
    const afterCreatorJoin = await f.escrow.matches(10n);
    expect(afterCreatorJoin.player1).to.equal(f.player1.address);
    expect(afterCreatorJoin.player1Deposited).to.equal(true);
  });

  it("rejects a late join after the waiting timeout", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(1n, f.entryFee, f.player1.address);
    await increaseTime(MATCH_TIMEOUT + 1n);
    await expect(f.escrow.connect(f.player1).joinMatch(1n)).to.be.revertedWith("match expired");
  });

  it("measures active timeout from startedAt instead of createdAt", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(2n, f.entryFee, f.player1.address);
    await increaseTime(MATCH_TIMEOUT - 60n);
    await f.escrow.connect(f.player1).joinMatch(2n);
    await f.escrow.connect(f.player2).joinMatch(2n);
    await f.escrow.connect(f.operator).startMatch(2n);
    await increaseTime(120n);
    await expect(f.escrow.reclaimActiveMatch(2n)).to.be.revertedWith("not expired");
    await increaseTime(MATCH_TIMEOUT);
    await f.escrow.reclaimActiveMatch(2n);
  });

  it("lets anyone refund a READY match if the operator never starts it", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(4n, f.entryFee, f.player1.address);
    await f.escrow.connect(f.player1).joinMatch(4n);
    await f.escrow.connect(f.player2).joinMatch(4n);
    await expect(f.escrow.connect(f.player1).reclaimReadyMatch(4n)).to.be.revertedWith("not expired");
    await increaseTime(MATCH_TIMEOUT + READY_GRACE + 1n);
    await f.escrow.connect(f.admin).reclaimReadyMatch(4n);
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
    await startFundedMatch(f, 5n);
    await expect(f.escrow.connect(f.operator).cancelMatch(5n)).to.be.revertedWith("invalid state");
  });

  it("stores the canonical winner on-chain", async function () {
    const f = await fixture();
    await startFundedMatch(f, 3n);
    await f.escrow.connect(f.operator).resolveMatch(3n, f.player2.address);
    const match = await f.escrow.matches(3n);
    expect(match.winner).to.equal(f.player2.address);
  });

  it("locks the platform fee when the match is created", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(6n, f.entryFee, f.player1.address);
    const created = await f.escrow.matches(6n);
    expect(created.feeBpsAtCreation).to.equal(500n);
    await f.escrow.connect(f.admin).setFee(1000n);
    expect(await f.escrow.platformFeeBps()).to.equal(1000n);
    await f.escrow.connect(f.player1).joinMatch(6n);
    await f.escrow.connect(f.player2).joinMatch(6n);
    await f.escrow.connect(f.operator).startMatch(6n);
    const winnerBalanceBefore = await f.token.balanceOf(f.player1.address);
    const treasuryBalanceBefore = await f.token.balanceOf(f.treasury.address);
    await f.escrow.connect(f.operator).resolveMatch(6n, f.player1.address);
    const totalPrize = f.entryFee * 2n;
    const lockedFee = (totalPrize * 500n) / 10_000n;
    const lockedPayout = totalPrize - lockedFee;
    expect((await f.token.balanceOf(f.player1.address)) - winnerBalanceBefore).to.equal(lockedPayout);
    expect((await f.token.balanceOf(f.treasury.address)) - treasuryBalanceBefore).to.equal(lockedFee);
  });

  it("locks the treasury when the match is created", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(11n, f.entryFee, f.player1.address);
    const created = await f.escrow.matches(11n);
    expect(created.treasuryAtCreation).to.equal(f.treasury.address);
    await f.escrow.connect(f.admin).setTreasury(f.newTreasury.address);
    await f.escrow.connect(f.player1).joinMatch(11n);
    await f.escrow.connect(f.player2).joinMatch(11n);
    await f.escrow.connect(f.operator).startMatch(11n);
    const originalTreasuryBefore = await f.token.balanceOf(f.treasury.address);
    const replacementTreasuryBefore = await f.token.balanceOf(f.newTreasury.address);
    await f.escrow.connect(f.operator).resolveMatch(11n, f.player1.address);
    const lockedFee = (f.entryFee * 2n * 500n) / 10_000n;
    expect((await f.token.balanceOf(f.treasury.address)) - originalTreasuryBefore).to.equal(lockedFee);
    expect(await f.token.balanceOf(f.newTreasury.address)).to.equal(replacementTreasuryBefore);
  });

  it("does not retroactively shorten the waiting timeout", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(7n, f.entryFee, f.player1.address);
    const created = await f.escrow.matches(7n);
    expect(created.waitingTimeoutAtCreation).to.equal(MATCH_TIMEOUT);
    await f.escrow.connect(f.admin).setTimeout(5n * 60n);
    await increaseTime(6n * 60n);
    await f.escrow.connect(f.player1).joinMatch(7n);
    const joined = await f.escrow.matches(7n);
    expect(joined.player1Deposited).to.equal(true);
  });

  it("does not retroactively shorten the READY grace period", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(12n, f.entryFee, f.player1.address);
    const created = await f.escrow.matches(12n);
    expect(created.readyGraceAtCreation).to.equal(READY_GRACE);
    await f.escrow.connect(f.admin).setReadyGrace(60n);
    await f.escrow.connect(f.player1).joinMatch(12n);
    await f.escrow.connect(f.player2).joinMatch(12n);
    await increaseTime(MATCH_TIMEOUT + 60n + 1n);
    await f.escrow.connect(f.operator).startMatch(12n);
    const started = await f.escrow.matches(12n);
    expect(started.status).to.equal(3n);
  });

  it("does not retroactively shorten an active match timeout", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(8n, f.entryFee, f.player1.address);
    const created = await f.escrow.matches(8n);
    expect(created.activeTimeoutAtCreation).to.equal(MATCH_TIMEOUT);
    await f.escrow.connect(f.admin).setActiveTimeout(5n * 60n);
    await f.escrow.connect(f.player1).joinMatch(8n);
    await f.escrow.connect(f.player2).joinMatch(8n);
    await f.escrow.connect(f.operator).startMatch(8n);
    await increaseTime(6n * 60n);
    await expect(f.escrow.reclaimActiveMatch(8n)).to.be.revertedWith("not expired");
    await increaseTime(25n * 60n);
    await f.escrow.reclaimActiveMatch(8n);
  });

  it("does not allow a late dispute to extend an already-expired active match", async function () {
    const f = await fixture();
    await startFundedMatch(f, 13n);
    await increaseTime(MATCH_TIMEOUT + 1n);
    await expect(f.escrow.connect(f.player1).disputeMatch(13n)).to.be.revertedWith("match expired");
  });

  it("does not allow operator settlement after the active refund deadline", async function () {
    const f = await fixture();
    await startFundedMatch(f, 17n);
    await increaseTime(MATCH_TIMEOUT + 1n);
    await expect(f.escrow.connect(f.operator).resolveMatch(17n, f.player1.address)).to.be.revertedWith("match expired");
    await f.escrow.connect(f.player2).reclaimActiveMatch(17n);
    const expired = await f.escrow.matches(17n);
    expect(expired.status).to.equal(7n);
  });

  it("refunds both players if a dispute is not resolved within its locked timeout", async function () {
    const f = await fixture();
    await startFundedMatch(f, 14n);
    const created = await f.escrow.matches(14n);
    expect(created.disputeTimeoutAtCreation).to.equal(DISPUTE_TIMEOUT);
    await f.escrow.connect(f.player1).disputeMatch(14n);
    const disputed = await f.escrow.matches(14n);
    expect(disputed.status).to.equal(5n);
    expect(disputed.disputedAt).to.be.greaterThan(0n);
    await expect(f.escrow.connect(f.admin).reclaimDisputedMatch(14n)).to.be.revertedWith("not expired");
    await increaseTime(DISPUTE_TIMEOUT + 1n);
    await f.escrow.connect(f.admin).reclaimDisputedMatch(14n);
    const expired = await f.escrow.matches(14n);
    expect(expired.status).to.equal(7n);
    expect(await f.token.balanceOf(f.player1.address)).to.equal(f.float);
    expect(await f.token.balanceOf(f.player2.address)).to.equal(f.float);
  });

  it("does not allow arbitration after the dispute refund deadline", async function () {
    const f = await fixture();
    await startFundedMatch(f, 18n);
    await f.escrow.connect(f.player1).disputeMatch(18n);
    await increaseTime(DISPUTE_TIMEOUT + 1n);
    await expect(f.escrow.connect(f.arbiter).resolveDispute(18n, f.player2.address)).to.be.revertedWith("dispute expired");
    await f.escrow.connect(f.player1).reclaimDisputedMatch(18n);
    const expired = await f.escrow.matches(18n);
    expect(expired.status).to.equal(7n);
  });

  it("does not retroactively shorten the dispute timeout", async function () {
    const f = await fixture();
    await f.escrow.connect(f.operator).createMatch(15n, f.entryFee, f.player1.address);
    await f.escrow.connect(f.admin).setDisputeTimeout(24n * 60n * 60n);
    await f.escrow.connect(f.player1).joinMatch(15n);
    await f.escrow.connect(f.player2).joinMatch(15n);
    await f.escrow.connect(f.operator).startMatch(15n);
    await f.escrow.connect(f.player2).disputeMatch(15n);
    await increaseTime(24n * 60n * 60n + 1n);
    await expect(f.escrow.reclaimDisputedMatch(15n)).to.be.revertedWith("not expired");
  });

  it("allows the arbiter to resolve an existing dispute while paused", async function () {
    const f = await fixture();
    await startFundedMatch(f, 16n);
    await f.escrow.connect(f.player1).disputeMatch(16n);
    await f.escrow.connect(f.admin).pause();
    await f.escrow.connect(f.arbiter).resolveDispute(16n, f.player2.address);
    const resolved = await f.escrow.matches(16n);
    expect(resolved.status).to.equal(4n);
    expect(resolved.winner).to.equal(f.player2.address);
  });

  it("assigns admin to the explicit address and leaves the deployer without control", async function () {
    const f = await fixture();
    const adminRole = ethers.ZeroHash;
    const operatorRole = await f.escrow.OPERATOR_ROLE();
    const arbiterRole = await f.escrow.ARBITER_ROLE();
    expect(await f.escrow.hasRole(adminRole, f.admin.address)).to.equal(true);
    expect(await f.escrow.hasRole(adminRole, f.deployer.address)).to.equal(false);
    expect(await f.escrow.hasRole(operatorRole, f.deployer.address)).to.equal(false);
    expect(await f.escrow.hasRole(arbiterRole, f.deployer.address)).to.equal(false);
  });

  it("requires explicit non-zero admin, operator and arbiter roles", async function () {
    const f = await fixture();
    const Escrow = await ethers.getContractFactory("SkillFiEscrowV3");
    await expect(
      Escrow.deploy(
        await f.token.getAddress(),
        ethers.ZeroAddress,
        f.operator.address,
        f.arbiter.address,
        f.treasury.address,
        500n,
      ),
    ).to.be.revertedWith("invalid admin");
    await expect(
      Escrow.deploy(
        await f.token.getAddress(),
        f.admin.address,
        ethers.ZeroAddress,
        f.arbiter.address,
        f.treasury.address,
        500n,
      ),
    ).to.be.revertedWith("invalid operator");
  });

  it("rejects overlapping critical identities at deployment", async function () {
    const f = await fixture();
    const Escrow = await ethers.getContractFactory("SkillFiEscrowV3");
    await expect(
      Escrow.deploy(
        await f.token.getAddress(),
        f.admin.address,
        f.admin.address,
        f.arbiter.address,
        f.treasury.address,
        500n,
      ),
    ).to.be.revertedWith("role overlap");
    await expect(
      Escrow.deploy(
        await f.token.getAddress(),
        f.admin.address,
        f.operator.address,
        f.operator.address,
        f.treasury.address,
        500n,
      ),
    ).to.be.revertedWith("role overlap");
  });

  it("prevents role grants and treasury updates from merging critical identities", async function () {
    const f = await fixture();
    const operatorRole = await f.escrow.OPERATOR_ROLE();
    const arbiterRole = await f.escrow.ARBITER_ROLE();
    const adminRole = ethers.ZeroHash;

    await expect(f.escrow.connect(f.admin).grantRole(operatorRole, f.arbiter.address)).to.be.revertedWith("role overlap");
    await expect(f.escrow.connect(f.admin).grantRole(arbiterRole, f.operator.address)).to.be.revertedWith("role overlap");
    await expect(f.escrow.connect(f.admin).grantRole(operatorRole, f.admin.address)).to.be.revertedWith("role overlap");
    await expect(f.escrow.connect(f.admin).grantRole(adminRole, f.operator.address)).to.be.revertedWith("role overlap");
    await expect(f.escrow.connect(f.admin).setTreasury(f.admin.address)).to.be.revertedWith("role overlap");
    await expect(f.escrow.connect(f.admin).setTreasury(f.operator.address)).to.be.revertedWith("role overlap");
    await expect(f.escrow.connect(f.admin).setTreasury(f.arbiter.address)).to.be.revertedWith("role overlap");
  });

  it("still allows rotation to a fresh separated operator", async function () {
    const f = await fixture();
    const operatorRole = await f.escrow.OPERATOR_ROLE();
    await f.escrow.connect(f.admin).grantRole(operatorRole, f.newOperator.address);
    expect(await f.escrow.hasRole(operatorRole, f.newOperator.address)).to.equal(true);
    await f.escrow.connect(f.admin).revokeRole(operatorRole, f.operator.address);
    expect(await f.escrow.hasRole(operatorRole, f.operator.address)).to.equal(false);
    expect(await f.escrow.hasRole(operatorRole, f.newOperator.address)).to.equal(true);
  });
});
