import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: "SkillFi Arena — Verifiable skill competition",
  description:
    "A controlled competitive-play pilot with deterministic games, shared rounds and inspectable results.",
  keywords: [
    "SkillFi",
    "skill games",
    "Arc testnet",
    "competitive gaming",
    "verifiable results",
  ],
  openGraph: {
    title: "SkillFi Arena — Verifiable skill competition",
    description:
      "Five deterministic pilot games, shared rounds and inspectable results.",
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
    <html lang="en" className="dark">
      <body className="font-body bg-arena-bg text-arena-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
