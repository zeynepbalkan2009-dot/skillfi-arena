import type { Metadata } from "next";
import { GameShell } from "@/components/GameShell";
import { PilotAdminClient } from "@/components/PilotAdminClient";

export const metadata: Metadata = { title: "Pilot Cohort Admin" };

export default function PilotAdminPage() {
  return <GameShell><PilotAdminClient /></GameShell>;
}
