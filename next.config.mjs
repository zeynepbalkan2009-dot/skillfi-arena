import path from "node:path";

const optionalPrivyModuleShim = path.resolve("./lib/optionalPrivyModuleShim.cjs");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "frame-src 'self' https://auth.privy.io https://*.privy.io",
  "connect-src 'self' https://*.privy.io https://*.walletconnect.com wss://*.walletconnect.com https://rpc.testnet.arc.network https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
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
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
