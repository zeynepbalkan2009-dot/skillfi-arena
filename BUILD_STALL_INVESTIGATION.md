# Build Stall Investigation Log

This is a temporary stabilization log for controlled frontend build isolation. Each experiment records the temporary change, result, and whether the change was kept.

## Completed Isolation Results

1. Minimal `app/layout.tsx` without providers still stalled when the real page/global app graph was active.
2. Static `app/page.tsx` alone did not fix the stall.
3. Minimal layout plus minimal page without `globals.css` built successfully.
4. Empty `next.config.mjs` did not fix the full-app stall.
5. Tailwind/global CSS built successfully with a minimal route, including the custom CSS layers.
6. Real provider tree plus static page reproduced the stall.
7. Dummy client provider built successfully.
8. React Query-only provider built successfully.
9. Adding `PrivyProvider` from `@privy-io/react-auth` reproduced the stall.
10. Updating `@privy-io/react-auth` from 3.32.1 to 3.32.2 did not fix the stall.
11. Package-level CommonJS alias for `@privy-io/react-auth` did not fix the stall and was removed.

## Final Outcome

The supported fix is documented in `BUILD_STALL_ROOT_CAUSE.md` and `PRIVY_BUILD_COMPATIBILITY.md`:

- keep Privy isolated in the smallest client-only runtime provider;
- disable Next's webpack build worker with `experimental.webpackBuildWorker: false`;
- keep optional Privy feature modules externalized in `next.config.mjs`;
- lazily construct the server-side Privy client.

After these changes, `npm run lint`, `npm run typecheck`, and `npm run build` complete successfully.
