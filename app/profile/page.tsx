import { ProfileClient } from "@/components/ProfileClient";
import { GameShell } from "@/components/GameShell";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return <GameShell><ProfileClient /></GameShell>;
}
