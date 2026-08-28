import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "SkillFi Arena — Play on skill. Settle in USDC.",
  description: "Verifiable peer-to-peer skill competitions with non-custodial USDC escrow and transparent onchain settlement.",
  keywords: ["SkillFi", "USDC", "Arc", "esports", "onchain settlement", "peer-to-peer payments"],
  openGraph: {
    title: "SkillFi Arena — Play on skill. Settle in USDC.",
    description: "A transparent settlement layer for competitive play, built around USDC.",
    type: "website",
    siteName: "SkillFi Arena",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-body bg-arena-bg text-arena-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
