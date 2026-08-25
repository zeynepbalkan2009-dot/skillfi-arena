# Build Stall Root Cause

## Summary

The frontend production build stall was isolated to the `@privy-io/react-auth` import graph during `next build`. React Query alone built successfully, a dummy provider built successfully, and the stall reproduced when `PrivyProvider` entered the production bundle.

The CommonJS alias experiment was removed. The supported fix kept in the repository is:

- keep Privy behind the smallest client-only runtime provider boundary;
- disable Next's webpack build worker with `experimental.webpackBuildWorker: false`;
- alias unused optional Privy feature modules to a bundled no-op shim so the browser bundle does not contain raw `require()` calls;
- lazily construct the server-side Privy client so route collection does not require production secrets during `next build`.

## What Was Tested

- Static page and minimal layout without providers: build completed.
- React Query provider only: build completed.
- `@privy-io/react-auth` provider import: build stalled.
- Privy patch update from `3.32.1` to `3.32.2`: did not resolve the stall by itself.
- package-level CommonJS webpack alias: did not resolve the stall and was removed.
- client-only Privy wrapper alone: did not resolve the stall.
- `experimental.webpackBuildWorker: false` with the smallest Privy runtime boundary: build completed.
- client-side CommonJS externals: build completed but production browser runtime failed with `require is not defined`; this was removed.
- optional package installation: failed because optional packages pulled additional optional peers into the production bundle.
- bundled optional-module shim aliases: build completed and removed the browser `require()` runtime error.

## Secondary Build Failure

After the worker stall was resolved, `next build` reached route data collection and failed because `lib/privy.ts` eagerly constructed `PrivyClient` and required `PRIVY_APP_SECRET` at module evaluation time.

That was fixed by exporting `getPrivyClient()` and constructing the SDK lazily only when authenticated API routes execute.

## Remaining Warning

The production build still emits a webpack critical dependency warning from Privy's transitive SDK graph through `viem/chains` and `ox/_esm/tempo/internal/virtualMasterPool.js`. The warning does not fail the build and is not caused by local `wagmi/chains` imports; `lib/contracts.ts` now defines the active Base Sepolia chain object locally to avoid adding another broad chain import.

## Final Verification

- `npm run build`: passed.
- Final build duration: `00:13:47.4008022`.
- Generated routes: `/`, `/_not-found`, `/api/auth/sync`, `/api/matches/create`.
- Production browser smoke: confirmed the prior `require is not defined` runtime error is gone.
- Remaining smoke blocker: local `.env.local` is missing `NEXT_PUBLIC_PRIVY_APP_ID`, so Privy login modal/authenticated-state validation cannot complete in this environment.
