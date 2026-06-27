/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Privy's React SDK bundles optional features (Solana wallets, the
    // Stripe fiat on-ramp, Farcaster mini-app support, React Native's
    // async-storage for MetaMask SDK) behind imports that webpack tries
    // to resolve statically even though this app only uses EVM/email
    // login and never touches those code paths at runtime. Marking them
    // as externals tells webpack "don't bundle this, it's fine if it's
    // missing" instead of failing the build looking for packages we
    // never installed on purpose.
    //
    // This is Privy's own documented workaround for the Solana entries
    // (see https://docs.privy.io/recipes/solana/getting-started-with-privy-and-solana)
    // extended to the other optional-feature modules this app hit.
    config.externals = config.externals || [];
    config.externals.push({
      "@solana/kit": "commonjs @solana/kit",
      "@solana-program/memo": "commonjs @solana-program/memo",
      "@solana-program/system": "commonjs @solana-program/system",
      "@solana-program/token": "commonjs @solana-program/token",
      "@stripe/crypto": "commonjs @stripe/crypto",
      "@farcaster/mini-app-solana": "commonjs @farcaster/mini-app-solana",
      "@react-native-async-storage/async-storage": "commonjs @react-native-async-storage/async-storage",
    });
    return config;
  },
};

export default nextConfig;
