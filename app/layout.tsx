import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: "SkillFi Arena — Queue up. Prove it.",
  description:
    "Five original skill games, one rival and a match result both sides can inspect. Enter the SkillFi Season 00 pilot.",
  keywords: [
    "SkillFi",
    "skill games",
    "Arc testnet",
    "competitive gaming",
    "verifiable results",
  ],
  openGraph: {
    title: "SkillFi Arena — Queue up. Prove it.",
    description:
      "Five original skill games. One rival. A result both sides can inspect.",
    type: "website",
    siteName: "SkillFi Arena",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light-theme">
      <body className="font-body bg-arena-bg text-arena-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
