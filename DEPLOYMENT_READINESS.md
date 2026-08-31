# SkillFi Arena — Deployment Readiness

## Current status

- Production build: passing on 28 August 2026
- Frontend typecheck: passing
- Lint: passing with no warnings
- Product tests: 12 passing
- Smart-contract tests: 48 passing
- Active local target: Arc Testnet
- Arc escrow: `0x263c8Eed47F11b7cd7E292139Afb5F774F033BFc`
- Canonical Arc USDC: `0x3600000000000000000000000000000000000000`
- Hosting project: not yet linked
- Public domain: not yet selected

## Required hosting environment variables

Copy values from the secure local environment or provider dashboards. Never paste secret values into source control, build logs, issues, or grant documents.

### Public

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_CHAIN_TARGET=arcTestnet`
- `NEXT_PUBLIC_ESCROW_ADDRESS=0x263c8Eed47F11b7cd7E292139Afb5F774F033BFc`
- `NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x3600000000000000000000000000000000000000`
- `NEXT_PUBLIC_GNESS_TOKEN_ADDRESS=0x3600000000000000000000000000000000000000`
- `NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network`
- `NEXT_PUBLIC_CONTACT_EMAIL` after public-contact approval

### Server-only secrets

- `SUPABASE_SERVICE_ROLE_KEY`
- `PRIVY_APP_SECRET`
- `OPERATOR_PRIVATE_KEY`
- `RPC_URL=https://rpc.testnet.arc.network`
- `OPERATOR_WALLET_ADDRESS=0xC86938446034FDC114e8422bC13dd18b9ED2F99F`
- Studio/admin variables documented by the active server environment

## Pre-launch checks

- Confirm all Supabase migrations through `11_beta_pilot.sql` are applied to the hosted project.
- Add the production URL to Privy's allowed origins and redirect configuration.
- Set the production URL in `NEXT_PUBLIC_APP_URL` so metadata, sitemap, and robots use the correct host.
- Confirm the operator wallet has only testnet funds and remains authorized on the Arc escrow.
- Confirm no private key or service-role value appears in the repository or deployment output.
- Run `npm run build`, `npm run test:product`, and the hosted Supabase validations.
- Open the deployed landing page, wallet login, lobby, profile, pilot, technology, and studio pages on desktop and mobile.
- Keep production-value deposits disabled; the current deployment and evidence are testnet-only.

## Grant demo checklist

- Stable HTTPS URL
- 60–90 second screen recording
- ArcScan deployment link
- Arc settlement, refund, and arbitration links
- Founder profile and pilot page
- Repository access or a technical review package
