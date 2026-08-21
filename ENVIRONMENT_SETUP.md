# Environment Setup

## Root Next.js Runtime

Use `.env.local.example` as the source of truth for the web app. Copy it to `.env.local` and set real values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_ESCROW_ADDRESS`
- `NEXT_PUBLIC_USDC_TOKEN_ADDRESS`
- `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`
- `RPC_URL`
- `OPERATOR_WALLET_ADDRESS`

Only values prefixed with `NEXT_PUBLIC_` are allowed in browser bundles. Service role, Privy secret, and operator wallet values are server-only.

## Web3 Runtime

Use `web3/.env.example` for Hardhat deployment and verification. The `web3/` workspace is the canonical contract workspace.

## Verification Commands

From repo root:

```bash
npm run lint
npm run typecheck
npm run test:product
npm run build
```

From `web3/`:

```bash
npm install
npx hardhat compile
npm run test
```

`next build` can compile without real server credentials when non-secret placeholder values are supplied by the command environment. Protected API requests still require real `PRIVY_APP_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` at runtime.
