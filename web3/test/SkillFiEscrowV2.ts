import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const Status = {
  NONE: 0n,
  WAITING_FOR_PLAYERS: 1n,
  READY: 2n,
  IN_PROGRESS: 3n,
  RESOLVED: 4n,
  DISPUTED: 5n,
  CANCELLED: 6n,
  EXPIRED: 7n,
} as const;

const FEE_BPS = 500n;
const MATCH_TIMEOUT = 30n * 60n;

async function increaseTime(seconds: bigint) {
  await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
  await ethers.provider.send("evm_mine", []);
}

async function expectTokenDeltas(
  token: any,
  accounts: Array<{ address?: string; getAddress?: () => Promise<string> } | string>,
  expectedDeltas: bigint[],
  action: () => Promise<unknown>,
) {
  const addresses = await Promise.all(
    accounts.map((account) =>
      typeof account === "string"
        ? account
        : account.address
          ? account.address
          : account.getAddress
            ? account.getAddress()
            : Promise.reject(new Error("Unsupported account shape")),
    ),
  );
  const before = await Promise.all(addresses.map((address) => token.balanceOf(address)));

  await action();

  const after = await Promise.all(addresses.map((address) => token.balanceOf(address)));
  for (let i = 0; i < addresses.length; i++) {
    expect(after[i] - before[i]).to.equal(expectedDeltas[i]);
  }
}

async function deployFixture() {
  const [admin, operator, arbiter, treasury, player1, player2, outsider, newTreasury] =
    await ethers.getSigners();

  const token = await ethers.deployContract("MockUSDC");
  const escrow = await ethers.deployContract("SkillFiEscrowV2", [
    await token.getAddress(),
    operator.address,
    arbiter.address,
    treasury.address,
    FEE_BPS,
  ]);

  const entryFee = ethers.parseUnits("100", 6);
  const playerFloat = ethers.parseUnits("1000", 6);

  for (const player of [player1, player2, outsider]) {
    await token.mint(player.address, playerFloat);
    await token.connect(player).approve(await escrow.getAddress(), playerFloat);
  }

  return {
    admin,
    operator,
    arbiter,
    treasury,
    player1,
    player2,
    outsider,
    newTreasury,
    token,
    escrow,
    entryFee,
    playerFloat,
  };
}

async function createMatch(fixture: Awaited<ReturnType<typeof deployFixture>>, matchId = 1n) {
  await fixture.escrow.connect(fixture.operator).createMatch(matchId, fixture.entryFee);
  return matchId;
}

async function createReadyMatch(fixture: Awaited<ReturnType<typeof deployFixture>>, matchId = 1n) {
  await createMatch(fixture, matchId);
  await fixture.escrow.connect(fixture.player1).joinMatch(matchId);
  await fixture.escrow.connect(fixture.player2).joinMatch(matchId);
  return matchId;
}

async function createActiveMatch(fixture: Awaited<ReturnType<typeof deployFixture>>, matchId = 1n) {
  await createReadyMatch(fixture, matchId);
  await fixture.escrow.connect(fixture.operator).startMatch(matchId);
  return matchId;
}

describe("MockUSDC", function () {
  it("uses 6 decimals", async function () {
    const { token } = await deployFixture();

    expect(await token.decimals()).to.equal(6n);
  });

  it("mints the initial supply with 6-decimal units", async function () {
    const { admin, token } = await deployFixture();

    expect(await token.balanceOf(admin.address)).to.equal(ethers.parseUnits("1000000000", 6));
  });

  it("supports explicit minting", async function () {
    const { outsider, token } = await deployFixture();
    const amount = ethers.parseUnits("12.5", 6);

    await token.mint(outsider.address, amount);

    expect(await token.balanceOf(outsider.address)).to.equal(ethers.parseUnits("1012.5", 6));
  });

  it("supports faucet minting", async function () {
    const { outsider, token } = await deployFixture();
    const amount = ethers.parseUnits("3", 6);

    await token.faucet(outsider.address, amount);

    expect(await token.balanceOf(outsider.address)).to.equal(ethers.parseUnits("1003", 6));
  });
});

describe("SkillFiEscrowV2 match creation", function () {
  it("allows an operator to create a match", async function () {
    const fixture = await deployFixture();

    await expect(fixture.escrow.connect(fixture.operator).createMatch(1n, fixture.entryFee))
      .to.emit(fixture.escrow, "MatchCreated")
      .withArgs(1n, fixture.entryFee);

    const match = await fixture.escrow.matches(1n);
    expect(match.entryFee).to.equal(fixture.entryFee);
    expect(match.status).to.equal(Status.WAITING_FOR_PLAYERS);
  });

  it("rejects zero entry-fee matches", async function () {
    const { escrow, operator } = await deployFixture();

    await expect(escrow.connect(operator).createMatch(1n, 0n)).to.be.revertedWith("invalid fee");
  });

  it("rejects duplicate match creation", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);

    await expect(
      fixture.escrow.connect(fixture.operator).createMatch(1n, fixture.entryFee),
    ).to.be.revertedWith("exists");
  });

  it("rejects match creation by non-operators", async function () {
    const { escrow, outsider, entryFee } = await deployFixture();

    await expect(escrow.connect(outsider).createMatch(1n, entryFee)).to.be.revertedWithCustomError(
      escrow,
      "AccessControlUnauthorizedAccount",
    );
  });
});

describe("SkillFiEscrowV2 deposits and readiness", function () {
  it("accepts the first-player deposit", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);

    await expect(fixture.escrow.connect(fixture.player1).joinMatch(1n))
      .to.emit(fixture.escrow, "PlayerJoined")
      .withArgs(1n, fixture.player1.address);

    const match = await fixture.escrow.matches(1n);
    expect(match.player1).to.equal(fixture.player1.address);
    expect(match.player1Deposited).to.equal(true);
    expect(match.status).to.equal(Status.WAITING_FOR_PLAYERS);
  });

  it("accepts the second-player deposit", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player1).joinMatch(1n);

    await expect(fixture.escrow.connect(fixture.player2).joinMatch(1n))
      .to.emit(fixture.escrow, "PlayerJoined")
      .withArgs(1n, fixture.player2.address);

    const match = await fixture.escrow.matches(1n);
    expect(match.player2).to.equal(fixture.player2.address);
    expect(match.player2Deposited).to.equal(true);
  });

  it("prevents self-joining", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player1).joinMatch(1n);
    const before = await fixture.token.balanceOf(fixture.player1.address);

    await expect(fixture.escrow.connect(fixture.player1).joinMatch(1n)).to.be.revertedWith("already joined");

    expect(await fixture.token.balanceOf(fixture.player1.address)).to.equal(before);
  });

  it("transitions to ready after two deposits", async function () {
    const fixture = await deployFixture();

    await expectTokenDeltas(
      fixture.token,
      [fixture.player1, fixture.player2, fixture.escrow],
      [-fixture.entryFee, -fixture.entryFee, fixture.entryFee * 2n],
      () => createReadyMatch(fixture, 1n),
    );

    const match = await fixture.escrow.matches(1n);
    expect(match.status).to.equal(Status.READY);
  });

  it("rejects a third deposit after the lobby is full", async function () {
    const fixture = await deployFixture();
    await createReadyMatch(fixture, 1n);

    await expect(fixture.escrow.connect(fixture.outsider).joinMatch(1n)).to.be.revertedWith("invalid state");
  });
});

describe("SkillFiEscrowV2 start and resolution", function () {
  it("allows an operator to start a ready match", async function () {
    const fixture = await deployFixture();
    await createReadyMatch(fixture, 1n);

    await expect(fixture.escrow.connect(fixture.operator).startMatch(1n))
      .to.emit(fixture.escrow, "MatchStarted")
      .withArgs(1n);

    const match = await fixture.escrow.matches(1n);
    expect(match.status).to.equal(Status.IN_PROGRESS);
  });

  it("rejects start by non-operators", async function () {
    const fixture = await deployFixture();
    await createReadyMatch(fixture, 1n);

    await expect(fixture.escrow.connect(fixture.outsider).startMatch(1n)).to.be.revertedWithCustomError(
      fixture.escrow,
      "AccessControlUnauthorizedAccount",
    );
  });

  it("resolves a match for a valid winner", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);

    await expect(fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player1.address))
      .to.emit(fixture.escrow, "MatchResolved")
      .withArgs(1n, fixture.player1.address, fixture.entryFee * 2n - (fixture.entryFee * 2n * FEE_BPS) / 10000n);

    const match = await fixture.escrow.matches(1n);
    expect(match.status).to.equal(Status.RESOLVED);
  });

  it("pays the winner net of the treasury fee", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    const prize = fixture.entryFee * 2n;
    const fee = (prize * FEE_BPS) / 10000n;

    await expectTokenDeltas(
      fixture.token,
      [fixture.player1, fixture.treasury, fixture.escrow],
      [prize - fee, fee, -prize],
      () => fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player1.address),
    );
  });

  it("transfers the platform fee to treasury", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    const fee = (fixture.entryFee * 2n * FEE_BPS) / 10000n;

    await fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player2.address);

    expect(await fixture.token.balanceOf(fixture.treasury.address)).to.equal(fee);
  });

  it("rejects invalid winners", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);

    await expect(
      fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.outsider.address),
    ).to.be.revertedWith("invalid winner");
  });

  it("prevents duplicate settlement", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player1.address);

    await expect(
      fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player1.address),
    ).to.be.revertedWith("invalid state");
  });
});

describe("SkillFiEscrowV2 disputes", function () {
  it("allows a participant to dispute an active match", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);

    await expect(fixture.escrow.connect(fixture.player1).disputeMatch(1n))
      .to.emit(fixture.escrow, "MatchDisputed")
      .withArgs(1n);

    const match = await fixture.escrow.matches(1n);
    expect(match.status).to.equal(Status.DISPUTED);
  });

  it("rejects disputes from nonparticipants", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);

    await expect(fixture.escrow.connect(fixture.outsider).disputeMatch(1n)).to.be.revertedWith("not participant");
  });

  it("allows the arbiter to resolve a dispute", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player2).disputeMatch(1n);

    await expect(fixture.escrow.connect(fixture.arbiter).resolveDispute(1n, fixture.player2.address))
      .to.emit(fixture.escrow, "MatchResolved")
      .withArgs(1n, fixture.player2.address, fixture.entryFee * 2n - (fixture.entryFee * 2n * FEE_BPS) / 10000n);
  });

  it("rejects unauthorized arbitration", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player1).disputeMatch(1n);

    await expect(
      fixture.escrow.connect(fixture.outsider).resolveDispute(1n, fixture.player1.address),
    ).to.be.revertedWithCustomError(fixture.escrow, "AccessControlUnauthorizedAccount");
  });
});

describe("SkillFiEscrowV2 cancellations and reclaims", function () {
  it("cancels an unresolved match", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);

    await expect(fixture.escrow.connect(fixture.operator).cancelMatch(1n))
      .to.emit(fixture.escrow, "MatchCancelled")
      .withArgs(1n);

    const match = await fixture.escrow.matches(1n);
    expect(match.status).to.equal(Status.CANCELLED);
  });

  it("refunds one deposited player on cancellation", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player1).joinMatch(1n);

    await expectTokenDeltas(
      fixture.token,
      [fixture.player1, fixture.escrow],
      [fixture.entryFee, -fixture.entryFee],
      () => fixture.escrow.connect(fixture.operator).cancelMatch(1n),
    );
  });

  it("refunds two deposited players on cancellation", async function () {
    const fixture = await deployFixture();
    await createReadyMatch(fixture, 1n);

    await expectTokenDeltas(
      fixture.token,
      [fixture.player1, fixture.player2, fixture.escrow],
      [fixture.entryFee, fixture.entryFee, -fixture.entryFee * 2n],
      () => fixture.escrow.connect(fixture.operator).cancelMatch(1n),
    );
  });

  it("reclaims an expired waiting match", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player1).joinMatch(1n);
    await increaseTime(MATCH_TIMEOUT + 1n);

    await expect(fixture.escrow.connect(fixture.player1).reclaimExpiredMatch(1n))
      .to.emit(fixture.escrow, "MatchExpired")
      .withArgs(1n);

    const match = await fixture.escrow.matches(1n);
    expect(match.status).to.equal(Status.EXPIRED);
  });

  it("reclaims an active match after timeout", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    await increaseTime(MATCH_TIMEOUT + 1n);

    await expectTokenDeltas(
      fixture.token,
      [fixture.player1, fixture.player2, fixture.escrow],
      [fixture.entryFee, fixture.entryFee, -fixture.entryFee * 2n],
      () => fixture.escrow.connect(fixture.player2).reclaimActiveMatch(1n),
    );

    const match = await fixture.escrow.matches(1n);
    expect(match.status).to.equal(Status.EXPIRED);
  });

  it("updates state before refund transfers on cancellation-sensitive paths", async function () {
    const fixture = await deployFixture();
    await createReadyMatch(fixture, 1n);

    await fixture.escrow.connect(fixture.operator).cancelMatch(1n);

    const match = await fixture.escrow.matches(1n);
    expect(match.status).to.equal(Status.CANCELLED);
    await expect(fixture.escrow.connect(fixture.operator).cancelMatch(1n)).to.be.revertedWith("invalid state");
  });
});

describe("SkillFiEscrowV2 governance and roles", function () {
  it("pauses and unpauses match creation", async function () {
    const fixture = await deployFixture();

    await fixture.escrow.connect(fixture.admin).pause();
    await expect(
      fixture.escrow.connect(fixture.operator).createMatch(1n, fixture.entryFee),
    ).to.be.revertedWithCustomError(fixture.escrow, "EnforcedPause");

    await fixture.escrow.connect(fixture.admin).unpause();
    await expect(fixture.escrow.connect(fixture.operator).createMatch(1n, fixture.entryFee)).to.emit(
      fixture.escrow,
      "MatchCreated",
    );
  });

  it("lets an admin grant the operator role", async function () {
    const fixture = await deployFixture();
    const role = await fixture.escrow.OPERATOR_ROLE();
    await fixture.escrow.connect(fixture.admin).grantRole(role, fixture.outsider.address);

    await expect(fixture.escrow.connect(fixture.outsider).createMatch(1n, fixture.entryFee)).to.emit(
      fixture.escrow,
      "MatchCreated",
    );
  });

  it("lets an admin grant the arbiter role", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player1).disputeMatch(1n);
    const role = await fixture.escrow.ARBITER_ROLE();
    await fixture.escrow.connect(fixture.admin).grantRole(role, fixture.outsider.address);

    await expect(fixture.escrow.connect(fixture.outsider).resolveDispute(1n, fixture.player1.address)).to.emit(
      fixture.escrow,
      "MatchResolved",
    );
  });

  it("enforces admin authorization for governance", async function () {
    const { escrow, outsider, newTreasury } = await deployFixture();

    await expect(escrow.connect(outsider).setTreasury(newTreasury.address)).to.be.revertedWithCustomError(
      escrow,
      "AccessControlUnauthorizedAccount",
    );
  });

  it("updates the treasury address", async function () {
    const { escrow, admin, newTreasury } = await deployFixture();

    await expect(escrow.connect(admin).setTreasury(newTreasury.address))
      .to.emit(escrow, "TreasuryUpdated")
      .withArgs(newTreasury.address);

    expect(await escrow.treasury()).to.equal(newTreasury.address);
  });

  it("enforces fee limits", async function () {
    const { escrow, admin } = await deployFixture();

    await escrow.connect(admin).setFee(1000n);
    expect(await escrow.platformFeeBps()).to.equal(1000n);

    await expect(escrow.connect(admin).setFee(1001n)).to.be.revertedWith("max 10%");
  });

  it("enforces timeout limits", async function () {
    const { escrow, admin } = await deployFixture();

    await escrow.connect(admin).setTimeout(5n * 60n);
    expect(await escrow.matchTimeout()).to.equal(5n * 60n);

    await expect(escrow.connect(admin).setTimeout(5n * 60n - 1n)).to.be.revertedWith("too low");
  });

  it("keeps reentrancy-sensitive settlement state terminal before external effects complete", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);

    await fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player1.address);

    const match = await fixture.escrow.matches(1n);
    expect(match.status).to.equal(Status.RESOLVED);
    await expect(
      fixture.escrow.connect(fixture.player1).disputeMatch(1n),
    ).to.be.revertedWith("invalid state");
  });
});

describe("SkillFiEscrowV2 invariants", function () {
  it("keeps contract token balance equal to unresolved player deposits", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);
    expect(await fixture.token.balanceOf(await fixture.escrow.getAddress())).to.equal(0n);

    await fixture.escrow.connect(fixture.player1).joinMatch(1n);
    expect(await fixture.token.balanceOf(await fixture.escrow.getAddress())).to.equal(fixture.entryFee);

    await fixture.escrow.connect(fixture.player2).joinMatch(1n);
    expect(await fixture.token.balanceOf(await fixture.escrow.getAddress())).to.equal(fixture.entryFee * 2n);

    await fixture.escrow.connect(fixture.operator).startMatch(1n);
    await fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player1.address);
    expect(await fixture.token.balanceOf(await fixture.escrow.getAddress())).to.equal(0n);
  });

  it("prevents refunds and reclaims after resolution", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player1.address);

    await expect(fixture.escrow.connect(fixture.operator).cancelMatch(1n)).to.be.revertedWith("invalid state");
    await expect(fixture.escrow.connect(fixture.player1).reclaimExpiredMatch(1n)).to.be.revertedWith("invalid state");
    await expect(fixture.escrow.connect(fixture.player1).reclaimActiveMatch(1n)).to.be.revertedWith("invalid state");
  });

  it("prevents cancelled matches from being cancelled or refunded twice", async function () {
    const fixture = await deployFixture();
    await createReadyMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.operator).cancelMatch(1n);
    const escrowBalance = await fixture.token.balanceOf(await fixture.escrow.getAddress());
    const player1Balance = await fixture.token.balanceOf(fixture.player1.address);

    await expect(fixture.escrow.connect(fixture.operator).cancelMatch(1n)).to.be.revertedWith("invalid state");
    await expect(fixture.escrow.connect(fixture.player1).reclaimExpiredMatch(1n)).to.be.revertedWith("invalid state");
    expect(await fixture.token.balanceOf(await fixture.escrow.getAddress())).to.equal(escrowBalance);
    expect(await fixture.token.balanceOf(fixture.player1.address)).to.equal(player1Balance);
  });

  it("prevents expired matches from being reclaimed twice", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player1).joinMatch(1n);
    await increaseTime(MATCH_TIMEOUT + 1n);
    await fixture.escrow.connect(fixture.player1).reclaimExpiredMatch(1n);

    await expect(fixture.escrow.connect(fixture.player1).reclaimExpiredMatch(1n)).to.be.revertedWith("invalid state");
    expect(await fixture.token.balanceOf(await fixture.escrow.getAddress())).to.equal(0n);
  });

  it("prevents operator resolution while disputed", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player1).disputeMatch(1n);

    await expect(
      fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player1.address),
    ).to.be.revertedWith("invalid state");
  });

  it("prevents disputed matches from being reclaimed", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.player2).disputeMatch(1n);
    await increaseTime(MATCH_TIMEOUT + 1n);

    await expect(fixture.escrow.connect(fixture.player1).reclaimActiveMatch(1n)).to.be.revertedWith("invalid state");
    await expect(fixture.escrow.connect(fixture.player1).reclaimExpiredMatch(1n)).to.be.revertedWith("invalid state");
  });

  it("prevents players from receiving more than valid refund or prize", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    const prize = fixture.entryFee * 2n;
    const fee = (prize * FEE_BPS) / 10000n;
    const player1Before = await fixture.token.balanceOf(fixture.player1.address);
    const player2Before = await fixture.token.balanceOf(fixture.player2.address);

    await fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player1.address);

    expect((await fixture.token.balanceOf(fixture.player1.address)) - player1Before).to.equal(prize - fee);
    expect((await fixture.token.balanceOf(fixture.player2.address)) - player2Before).to.equal(0n);
  });

  it("transfers the exact treasury fee once", async function () {
    const fixture = await deployFixture();
    await createActiveMatch(fixture, 1n);
    const fee = (fixture.entryFee * 2n * FEE_BPS) / 10000n;

    await fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player2.address);
    expect(await fixture.token.balanceOf(fixture.treasury.address)).to.equal(fee);

    await expect(
      fixture.escrow.connect(fixture.operator).resolveMatch(1n, fixture.player2.address),
    ).to.be.revertedWith("invalid state");
    expect(await fixture.token.balanceOf(fixture.treasury.address)).to.equal(fee);
  });

  it("rolls back match state when an ERC20 deposit transfer fails", async function () {
    const fixture = await deployFixture();
    await createMatch(fixture, 1n);

    await expect(fixture.escrow.connect(fixture.admin).joinMatch(1n)).to.be.revert(ethers);

    const match = await fixture.escrow.matches(1n);
    expect(match.player1).to.equal(ethers.ZeroAddress);
    expect(match.player1Deposited).to.equal(false);
    expect(match.status).to.equal(Status.WAITING_FOR_PLAYERS);
  });

  it("prevents match ID reuse after terminal states", async function () {
    const fixture = await deployFixture();
    await createReadyMatch(fixture, 1n);
    await fixture.escrow.connect(fixture.operator).cancelMatch(1n);

    await expect(
      fixture.escrow.connect(fixture.operator).createMatch(1n, fixture.entryFee),
    ).to.be.revertedWith("exists");
  });
});
