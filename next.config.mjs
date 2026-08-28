import path from "node:path";

const optionalPrivyModuleShim = path.resolve("./lib/optionalPrivyModuleShim.cjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    webpackBuildWorker: false,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@farcaster/mini-app-solana": optionalPrivyModuleShim,
      "@farcaster/miniapp-sdk": optionalPrivyModuleShim,
      "@react-native-async-storage/async-storage": optionalPrivyModuleShim,
      "@solana/wallet-adapter-react": optionalPrivyModuleShim,
      "@stripe/crypto": optionalPrivyModuleShim,
      "@stripe/stripe-js": optionalPrivyModuleShim,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
