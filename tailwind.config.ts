import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
  "./app/**/*.{js,ts,jsx,tsx,mdx}",
  "./components/**/*.{js,ts,jsx,tsx,mdx}",
],
  theme: {
    extend: {
      colors: {
        // Dark, slightly-cool neutrals rather than pure black/gray — reads
        // less "default dark mode" and closer to a competitive-gaming HUD.
        "arena-bg": "#0a0e14",
        "arena-surface": "#10151d",
        "arena-border": "#1f2733",
        "arena-text": "#e2e8f0",
        "arena-muted": "#7c8aa0",
        "arena-accent": "#22d3ee",
        "arena-accent-dim": "#0e7490",
        "arena-win": "#34d399",
        "arena-danger": "#f87171",
      },
      fontFamily: {
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Rajdhani", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "arena-glow": "0 0 0 1px rgba(34,211,238,0.15), 0 0 24px -8px rgba(34,211,238,0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
