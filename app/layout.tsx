import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillFi Arena",
  description: "Skill-based PvP wagering, settled on-chain.",
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
