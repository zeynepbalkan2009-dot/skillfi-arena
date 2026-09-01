# SkillFi Arena — 5 Game / 100 Player Pilot Readiness

## What is ready to test

- Five original deterministic skill games: Typing Sprint, Arithmetic Rush, Sequence Recall, Pattern Lock, and Logic Grid.
- A browser-based pilot lab at `/pilot/games` with deterministic rounds and score calculation.
- A 100-concurrent-request, read-only load test covering the public site, game lab, guild page, and guild API.
- An isolated database capacity test with 100 players, 10 guilds, 100 memberships, 10 proposals, and 100 votes.
- One-guild-per-player enforcement and immutable guild treasury history checks.

## IP and licensing controls

The five pilot games use SkillFi-authored names, rules, prompts, scoring logic, and interface code. They do not bundle third-party game executables, characters, logos, maps, music, screenshots, or trademarked game names. This materially reduces copyright, trademark, and game-publisher licensing risk.

Before adding any external commercial game, obtain written integration/tournament permission or rely on a documented publisher community-tournament policy. Store the permission source, permitted territories, prize limits, branding rules, and expiry/review date with the game record.

## Legal boundary

This is an engineering readiness statement, not legal advice or a guarantee that operation is lawful in every country. The pilot games are currently designed for no-deposit, no-prize testing. Keep paid entry, cash-equivalent prizes, custody, lending, prediction markets, and production-value settlement disabled until qualified counsel reviews:

- skill-contest, gambling, sweepstakes, and prize-promotion rules by territory;
- age eligibility, parental consent, sanctions, KYC/AML, tax, and consumer-protection duties;
- privacy policy, retention, deletion, incident response, and data-processing agreements;
- USDC/onchain settlement, custody, money-transmission, and treasury execution flows;
- accessibility, community moderation, dispute handling, and tournament terms.

## Required acceptance commands

```bash
npm run typecheck
npm run test:product
npm run test:guild:100
SKILLFI_LIVE_URL=https://skillfi-arena.vercel.app npm run test:live
SKILLFI_LOAD_URL=https://skillfi-arena.vercel.app npm run test:load:100
```

Passing these commands confirms the implemented software checks only. A real pilot still needs named test participants, consent, support coverage, monitoring, a rollback plan, and a documented incident owner.

The latest measured acceptance result is recorded in [`PILOT_ACCEPTANCE_REPORT.md`](./PILOT_ACCEPTANCE_REPORT.md).
