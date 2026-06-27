import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Rajdhani gives headings the angular, technical look common to esports
// branding (FACEIT, ESL); Inter stays on body text where that look would
// hurt readability at small sizes.
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "SkillFi Arena",
  description: "Skill-based PvP wagering, settled on-chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${rajdhani.variable} font-body bg-arena-bg text-arena-text antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
