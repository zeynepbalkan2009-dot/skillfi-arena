# Privy Build Compatibility

## Final Decision

The CommonJS alias was removed. It was an unsupported package-export bypass and did not fix the production build stall.

The final compatibility approach is a supported architectural isolation:

- `app/providers.tsx` dynamically imports `components/PrivyRuntimeProviders.tsx` with `ssr: false`.
- `components/PrivyRuntimeProviders.tsx` is the only runtime boundary that imports `@privy-io/react-auth`.
- `next.config.mjs` disables Next's webpack build worker because the worker path stalls on the Privy client graph in this repository.
- `next.config.mjs` aliases unused optional Privy feature modules to `lib/optionalPrivyModuleShim.cjs` so webpack bundles a browser-safe no-op module instead of emitting `require()` calls.
- `lib/privy.ts` constructs `@privy-io/node` lazily on the server.

## Why This Is Safe

- Privy is still the active auth provider.
- Privy is not mocked or removed.
- SSR is disabled only for the small provider wrapper, not for the whole app.
- Server auth remains server-only through `server-only` and `@privy-io/node`.
- `PRIVY_APP_SECRET` is never exposed to the browser.
- Wagmi remains nested under the Privy runtime provider.
- React Query remains a normal client provider and is created once per browser session.
- The shimmed modules are optional non-MVP paths: Farcaster mini-app Solana, Stripe fiat on-ramp, React Native async storage, Solana wallet adapter React, and Stripe.js.

## Runtime Expectations

The production runtime should expose:

- Privy provider initialization;
- login button rendering through `components/WalletConnect.tsx`;
- login modal with email and wallet options;
- no hydration mismatch caused by Privy server evaluation;
- AuthSync execution after an authenticated Privy session exists;
- Wagmi hooks available under the provider tree.

Full authenticated-state validation still requires real Privy credentials, a configured Privy app, and a browser login session. The local `.env.local` checked during stabilization only contained `RPC_URL`, so the browser smoke stopped at the expected missing `NEXT_PUBLIC_PRIVY_APP_ID` configuration error.
