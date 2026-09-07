import type { Metadata } from "next";
import { GameShell } from "@/components/GameShell";
import { PilotAdminClient } from "@/components/PilotAdminClient";
import { PilotReadinessPanel } from "@/components/PilotReadinessPanel";

export const metadata: Metadata = { title: "Pilot Cohort Admin" };

export default function PilotAdminPage() {
  return <GameShell><div className="mx-auto max-w-6xl px-5"><PilotReadinessPanel /></div><PilotAdminClient /></GameShell>;
}
