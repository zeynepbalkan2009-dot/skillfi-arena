// Mirrors the enums and tables defined in the SkillFi Arena Postgres schema.
// Keeping these hand-in-sync (rather than codegen'd) is fine at this scale,
// but if the schema grows, point `supabase gen types typescript` at the
// project and replace this file with the generated output.

export type UserRegion = "EU" | "NA" | "ASIA";
export type GameType = "web2" | "web3";
export type MatchStatus =
  | "searching"
  | "waiting_on_chain"
  | "active"
  | "settling"
  | "completed"
  | "cancelled";
export type ChallengeStatus = "open" | "accepted" | "expired" | "cancelled";
export type OpponentMode = "open" | "invite";
export type CurrencyCode = "USDC";

export interface Game {
  id: string;
  name: string;
  type: GameType;
  is_active: boolean;
  created_at: string;
}

/** Public profile fields only — never the user_risk_profiles table. */
export interface PlayerProfile {
  id: string;
  privy_user_id?: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  region: UserRegion;
  email?: string | null;
  wallet_address: string | null;
  primary_wallet_address?: string | null;
  wins?: number;
  losses?: number;
  matches_played?: number;
  elo_rating?: number;
  total_earnings?: string;
  created_at?: string;
  last_login_at?: string | null;
}

export interface Match {
  id: string;
  challenge_id?: string | null;
  smart_contract_match_id: string | null;
  game_id: string;
  player_a_id: string;
  player_b_id: string | null;
  // NUMERIC(78,0) columns come back from Postgres/PostgREST as strings, not
  // numbers — a JS `number` cannot losslessly hold a raw 18-decimal token
  // amount. Keep this as a string end-to-end and only convert to BigInt at
  // the point of actually calling the contract.
  stake_amount: string;
  status: MatchStatus;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the lobby query, which embeds the game and creator. */
export interface MatchWithRelations extends Match {
  game: Game | null;
  player_a: PlayerProfile | null;
  player_b?: PlayerProfile | null;
  challenge?: Challenge | null;
}

export interface Challenge {
  id: string;
  invitation_url?: string | null;
  game_id: string;
  creator_id: string;
  invited_opponent_id: string | null;
  accepted_by_id: string | null;
  match_id: string | null;
  entry_fee: string;
  currency: CurrencyCode;
  opponent_mode: OpponentMode;
  rules: string;
  status: ChallengeStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChallengeWithRelations extends Challenge {
  game: Game | null;
  creator: PlayerProfile | null;
  invited_opponent?: PlayerProfile | null;
  accepted_by?: PlayerProfile | null;
  match?: MatchWithRelations | null;
}
