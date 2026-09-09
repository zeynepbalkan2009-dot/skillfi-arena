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
        // Deep launcher-blue system inspired by game libraries, with a
        // distinct SkillFi cyan rather than any platform's exact palette.
        "arena-bg": "#f1f2ef",
        "arena-surface": "#fafaf8",
        "arena-border": "#ced4d5",
        "arena-text": "#23333e",
        "arena-muted": "#526571",
        "arena-accent": "#00769e",
        "arena-accent-dim": "#087fb2",
        "arena-win": "#34d399",
        "arena-danger": "#f87171",
      },
      fontFamily: {
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Rajdhani", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "arena-glow": "0 0 0 1px rgba(18,191,243,0.2), 0 0 28px -8px rgba(18,191,243,0.5)",
      },
    },
  },
  plugins: [],
};
export default config;
