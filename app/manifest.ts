import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkillFi Arena",
    short_name: "SkillFi",
    description: "Verifiable peer-to-peer skill competitions settled in USDC.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f2ef",
    theme_color: "#f1f2ef",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
