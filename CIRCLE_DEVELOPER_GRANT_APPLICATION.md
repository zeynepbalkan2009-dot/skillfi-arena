# SkillFi Arena — Circle Developer Grants Application Draft

> Working draft for the Circle/Questbook portal. Replace every `[NEEDED]` field with verified information before submission. Do not claim production users or revenue unless evidence is available.

## 1. Application snapshot

**Project name:** SkillFi Arena

**Category:** Peer-to-peer payments / programmable escrow / emerging-market digital work and competition infrastructure

**One-line description:** SkillFi Arena turns skill-based digital competitions into verifiable, non-custodial USDC payment flows, using Arc as the settlement layer from player deposits through outcome-based payout.

**Stage:** Functional MVP with a tested two-player challenge lifecycle, wallet-based identity, database-backed match state, an audited event trail, and a USDC escrow contract exercised end-to-end on Base Sepolia and Arc Testnet. The public Arc run used Circle's canonical USDC interface and completed two deposits, match start, result settlement, winner payout, and zero residual escrow balance.

**Website/demo:** [NEEDED]

**Repository:** [NEEDED — public link or grant-review access]

**Primary contact:** Zeynep Balkan — Founder, SkillFi Arena — zeynep.balkan2009@gmail.com

**Company/legal entity and jurisdiction:** Pre-incorporation founder-led project based in Türkiye. The team is prepared to establish an appropriate legal entity if required for grant contracting, compliance, or production launch.

**Funding requested:** 50,000 USDC (proposed; milestone-based and open to Circle's guidance)

**Grant duration:** 16 weeks

## 2. Short project description

SkillFi Arena is a peer-to-peer competitive platform where two players create a challenge, commit an equal USDC stake, play a skill-based match, and receive a deterministic onchain payout after an authorized result is recorded. The product combines embedded wallet onboarding, invitation-based matchmaking, a non-custodial escrow contract, server-side risk controls, and an immutable transaction trail.

The first use case is esports competition, but the underlying primitive is broader: a programmable, outcome-based USDC settlement rail for digital work and skill. Arc will become the core settlement network rather than an optional deployment target. Player deposits, escrow state, settlement, payout, and protocol-volume measurement will all occur on Arc.

## 3. Problem

Competitive players—especially in emerging markets—can find opponents globally but lack a neutral, fast, dollar-denominated way to settle small skill-based payments. Existing tournament systems often require a centralized custodian, impose geographic payment constraints, delay payouts, or provide little transparency when a result is disputed.

SkillFi Arena addresses this with:

- USDC-denominated stakes that avoid local-currency volatility during a match.
- Non-custodial escrow with explicit lifecycle transitions.
- Deterministic settlement and an auditable link between match state and money movement.
- Wallet onboarding designed to hide unnecessary blockchain complexity.
- Risk limits and operator controls before real-value deployment.

## 4. Why Arc and Circle are core

Arc is the proposed system of record for value movement in SkillFi Arena. The product cannot complete its primary user promise—deposit, escrow, result-based settlement, and payout—without the Arc transaction lifecycle.

Planned Circle integrations:

1. **Arc:** canonical network for challenge escrow, settlement, payout, and protocol-volume accounting.
2. **USDC:** sole settlement asset for the grant deliverable, including stakes and payouts.
3. **Circle Wallets:** evaluated and integrated for lower-friction player onboarding and wallet operations, subject to product and regional availability.
4. **CCTP and/or Gateway:** a follow-on path for players whose USDC starts on another supported chain, allowing liquidity to reach the Arc settlement flow without fragmented application balances.

This architecture expands USDC utility through repeated, real-world P2P transactions rather than using USDC only as a displayed balance or optional payment method.

## 5. What has already been shipped

- Next.js product MVP with Privy authentication and wallet connectivity.
- Supabase-backed profiles, challenges, matches, and two-player participation records.
- Invitation-based challenge creation and atomic acceptance.
- Canonical match-detail and live-match experiences.
- `SkillFiEscrowV2` Solidity contract and a 48-test contract suite.
- End-to-end Base Sepolia exercise covering match creation, approvals, two player deposits, start, result submission, settlement, payout, and zero residual escrow balance.
- Arc Testnet escrow deployment using canonical USDC, with bytecode, roles, treasury, fee, token-address, and chain-ID checks passing.
- Public Arc Testnet two-player settlement evidence covering create, approve, deposit, start, resolve, payout, and zero residual escrow balance. Settlement transaction: `0xbcbeb0fb24fc0ec50b242f71a118b934df84820266e27adae228125a5173bdf1`.
- Public Arc Testnet safety-path evidence covering two-player cancellation/refunds and participant dispute/arbiter resolution. Both paths returned escrow to zero and rejected repeated terminal actions. Refund transaction: `0x4b2ad25aca38f23c99c8a12cb568de71506389d0aecdf0079ca11d571242bdff`; arbitration transaction: `0x507ebe3f9c37bc5ea4deee77cbc6cf80a524c3471c2082937253717eb6fe7153`.
- Server-side reconciliation and retry handling between onchain and application state.
- Immutable, idempotent lifecycle audit events visible to related users.
- Hosted API integration and concurrency tests for the two-player acceptance flow.

These artifacts demonstrate shipping capacity. The grant would fund completion and scaling of the Arc-native product flow, production hardening, pilots, and measurable ecosystem usage—not the creation of a first prototype.

## 6. Differentiation

SkillFi Arena treats a competitive match as a programmable payment agreement, not merely a game lobby with a crypto checkout. The architecture joins identity, equal-stake escrow, explicit state transitions, outcome authorization, payout reconciliation, and user-visible audit records in one flow. The same settlement primitive can later support coaching bounties, creator challenges, verified micro-work, and agent-mediated competitions.

## 7. Proposed milestones

### Milestone 1 — Arc lifecycle hardening and reproducibility (10,000 USDC; weeks 1–4)

**Deliverables**

- Convert the successful Arc smoke flow into repeatable CI and operational test suites.
- Exercise settlement, cancellation, expiry, refund, dispute, and reconciliation paths against Arc Testnet.
- Add event monitoring, failure classification, balance invariants, and an operator runbook.
- Publish an Arc integration note and reproducible test instructions based on the deployed contract.

**Acceptance metrics**

- Existing Arc deployment remains configuration-valid against canonical USDC.
- All contract tests passing, with no regression from the current 48-test baseline.
- At least 100 automated end-to-end Arc Testnet cycles across settlement and refund paths.
- Zero unexplained escrow balance after completed or refunded test flows.

### Milestone 2 — Player-ready Circle UX and safety controls (15,000 USDC; weeks 5–8)

**Deliverables**

- Complete Arc deposit and payout UX in the production web flow.
- Integrate or complete a documented technical evaluation of Circle Wallets for embedded onboarding.
- Enforce daily stake/loss limits before deposits.
- Add settlement authorization, recovery, reconciliation, monitoring, and user-visible transaction status.

**Acceptance metrics**

- At least 30 invited pilot users complete an Arc testnet challenge.
- At least 90% successful completion rate for funded test matches, excluding user abandonment.
- Every money-state transition produces an immutable, idempotent audit record.
- No critical or high-severity unresolved finding in the scoped security review.

### Milestone 3 — Closed pilot and repeat usage (15,000 USDC; weeks 9–12)

**Deliverables**

- Run a controlled pilot with at least two gaming communities or university/esports partners.
- Add operational dispute handling with clearly documented boundaries; do not market chance-based wagering.
- Instrument unique funded wallets, settlement count, settlement volume, completion time, repeat usage, refunds, and failure rate.
- Publish a pilot report with anonymized metrics and lessons.

**Acceptance metrics**

- 100 unique funded pilot wallets.
- 250 completed Arc-settled matches.
- At least 20% of funded users complete a second match during the pilot.
- Two written pilot/launch partner commitments.

### Milestone 4 — Mainnet readiness and ecosystem handoff (10,000 USDC; weeks 13–16)

**Deliverables**

- Complete Arc mainnet deployment readiness, timed to network availability and Circle approval.
- Produce an independent smart-contract/security review and resolve critical/high findings.
- Publish an open integration reference showing how outcome-based applications can use the escrow lifecycle on Arc.
- Deliver a 90-day post-grant growth plan and CCTP/Gateway liquidity-onboarding design.

**Acceptance metrics**

- Mainnet deployment or Circle-approved mainnet-ready release if mainnet access/timing is external to the team.
- Public documentation and verified deployment artifacts.
- Monitoring and incident-response runbook tested through a tabletop exercise.
- Defined targets for the first 1,000 funded wallets and 10,000 Arc settlements.

## 8. Grant budget

| Area | USDC | Purpose |
| --- | ---: | --- |
| Arc and Circle integration engineering | 18,000 | Lifecycle hardening, app integration, wallet/CCTP/Gateway work |
| Security and production hardening | 12,000 | Independent review, fixes, monitoring, incident readiness |
| Product and data instrumentation | 8,000 | Deposit/payout UX, reconciliation, analytics |
| Pilot operations and partner onboarding | 7,000 | Community pilots, support, documentation |
| Legal/compliance scoping | 5,000 | Jurisdictional review, terms, eligibility and product classification |
| **Total** | **50,000** | |

Grant funds will not be used to subsidize user stakes, create artificial transaction volume, or promise returns.

## 9. Business model and path to sustainability

SkillFi Arena plans to charge a transparent platform fee on completed settlements, with no fee on cancelled or properly refunded matches. The initial go-to-market focuses on organized communities, university clubs, amateur tournament operators, and creators who already coordinate competitive play but lack integrated settlement infrastructure.

Potential expansion paths include B2B settlement tooling for tournament organizers, API access to the escrow lifecycle, sponsored competitions, and non-gaming skill-payment formats. Pricing, fee routing, and availability will be finalized only after legal and compliance review.

## 10. Go-to-market and traction plan

The initial wedge is small, invitation-based, two-player competition. It minimizes coordination overhead and creates a measurable transaction loop: invite → fund → play → verify → settle → repeat.

Before submission, attach verified evidence for:

- Current working demo and deployment URL.
- Number of test users, connected wallets, created challenges, accepted challenges, and completed settlement tests.
- Named pilot conversations, letters of intent, or community partnerships.
- Founder interviews or user research demonstrating the payment problem.
- Screenshots and transaction links for the end-to-end escrow exercise.

Do not substitute projections for current traction. Label forecasts clearly.

## 11. Ecosystem impact

Each successful SkillFi match produces multiple Arc interactions and expands USDC utility through deposits, escrow, and payout. The project can bring digitally native, emerging-market users into repeat stablecoin activity through a familiar use case, while the published integration reference gives other builders a reusable pattern for outcome-based P2P settlement.

Core grant metrics will include unique funded wallets, completed settlements, USDC settlement volume, repeat-user rate, median settlement time, refunds, failures, and partner-originated users.

## 12. Team

**Founder and role:** Zeynep Balkan — Founder and Business Development Lead

**Relevant background:** Zeynep is a business development and strategic partnerships professional with 7+ years of experience across mobile gaming, technology, Web3, and digital ecosystems. She has led or supported international partner acquisition, go-to-market strategy, commercial negotiations, market research, and strategic account development. She has evaluated and engaged with 50+ gaming, Web3, AI, and technology companies and advised 20+ gaming, technology, Web3, and startup projects. Her experience includes Head of Business Development at Everything Wondrous, partnerships work at Seedify, strategy and partnerships at Janus Interactive, business development and technical analysis at Metaverse Game Studios, and co-founding the early-stage gaming venture Cryptulpar Games. She has also served as a Women in Games Ambassador since 2021.

**Current commitment:** [NEEDED — full-time/part-time and start date]

**Founder-market fit:** Zeynep has direct experience at the intersection of gaming ecosystems, developer relations, Web3 infrastructure, commercial partnerships, and international market development. This maps to SkillFi's initial challenge: recruiting gaming communities and ecosystem partners while translating a technical settlement product into a credible commercial proposition.

**Technical ownership:** The project has shipped the application, contract, hosted data flow, concurrency protections, audit trail, and end-to-end test deployment. Before submission, identify the individuals responsible for smart contracts, backend/application engineering, security, and ongoing technical maintenance; do not imply that business leadership alone covers those functions.

**Professional link:** https://www.linkedin.com/in/zeynep-balkan-3709a8193

**Technical links:** [NEEDED — GitHub profile and public/private repository access]

## 13. Risks and mitigation

### Regulatory and product-classification risk

Real-money skill competitions may be treated differently by jurisdiction. The product will use geo/age eligibility, limits, clear skill-based rules, legal review, and restricted pilots. Launch claims and availability will follow counsel; the grant scope does not assume global legal availability.

### Result integrity and disputes

The first pilot uses authorized result submission, immutable events, replay protection, and operational review. Future game-server or tournament integrations will reduce reliance on manual evidence.

### Smart-contract and key risk

The plan includes least-privilege operator roles, multisig/secure key operations where supported, pause/recovery procedures, an independent review, monitoring, and reconciliation.

### Adoption risk

The product starts with existing organized communities and measurable partner pilots instead of relying on broad consumer acquisition.

## 14. Suggested answers for short portal fields

### Why is this a strong fit for Circle Developer Grants?

SkillFi Arena makes Arc and USDC the core settlement rail for repeat peer-to-peer economic activity. We have already shipped a working product flow, a tested USDC escrow contract, database reconciliation, and immutable audit records. The grant converts that execution into an Arc-native pilot with measurable funded wallets, settlement volume, repeat usage, and reusable developer documentation. Funding is tied to verifiable technical and adoption milestones rather than an idea-stage roadmap.

### What will the grant unlock?

The grant will fund four concrete outcomes: an Arc-native verified escrow deployment; player-ready Circle wallet and USDC flows with risk controls; controlled community pilots producing real usage metrics; and a security-reviewed, mainnet-ready release with a reusable Arc settlement reference. It accelerates the work that is hardest to finance before revenue—security, compliance scoping, production operations, and partner pilots.

### How does the project expand USDC utility?

USDC is the unit of account and settlement asset for every funded SkillFi challenge. Two player deposits are locked under explicit match rules and released through an outcome-based payout or refund path. This creates repeat, auditable P2P payment activity and a pathway for users in volatile-currency markets to transact in a stable digital dollar without SkillFi taking custody of pooled balances.

### What does success look like at the end of the grant?

Success means a security-reviewed Arc implementation, at least 100 funded pilot wallets, 250 completed Arc-settled matches, a 20% repeat-funded-user rate, two written community partner commitments, complete transaction analytics, and a mainnet deployment or Circle-approved mainnet-ready build depending on network availability.

## 15. Submission blockers checklist

- [ ] Confirm that the application window is open in the Questbook portal.
- [ ] Add founder names, biographies, roles, time commitment, and links.
- [ ] Confirm whether Circle can contract with the founder before incorporation or requires an entity before acceptance/disbursement.
- [ ] Add the founder's legal jurisdiction and verified project contact; do not describe SkillFi Arena as an incorporated company.
- [ ] Add a stable live demo URL and a 60–90 second demo video.
- [ ] Provide repository access and a concise technical architecture diagram.
- [x] Deploy and validate the escrow on Arc Testnet using canonical USDC. Contract: `0x263c8Eed47F11b7cd7E292139Afb5F774F033BFc`; deployment transaction: `0x2097e71075fab851047979f65fe4910a0fc13b4e77053f3a953da500bf9c6a30`.
- [x] Capture a complete two-player Arc testnet deposit-to-payout cycle with transaction evidence. Evidence file: `ARC_TESTNET_E2E_EVIDENCE.md`.
- [ ] Record truthful baseline traction metrics.
- [ ] Secure two credible pilot letters or named partner confirmations.
- [ ] Validate the 50,000 USDC request against the portal's available tier or guidance.
- [ ] Obtain legal advice on skill-competition classification, user eligibility, custody, sanctions, AML implications, and geographic restrictions.
- [ ] Remove any unsupported claims, confidential credentials, or personal data.

## 16. Recommended submission strategy

Do not submit immediately. First deploy the existing escrow flow to Arc testnet, capture one complete two-player settlement with transaction links, publish the demo, and obtain at least one written pilot commitment. These three additions turn the application from a credible technical proposal into the kind of Arc-forward, execution-backed case Circle says it prioritizes.
