// Mirrors the enums and tables defined in the SkillFi Arena Postgres schema.
// Keeping these hand-in-sync (rather than codegen'd) is fine at this scale,
// but if the schema grows, point `supabase gen types typescript` at the
// project and replace this file with the generated output.

export type UserRegion = "EU" | "NA" | "ASIA";
export type GameType = "web2" | "web3";
export type GameIntegrationStatus = "draft" | "submitted" | "sandbox" | "published" | "rejected" | "suspended";
export type MatchStatus =
  | "searching"
  | "waiting_on_chain"
  | "active"
  | "settling"
  | "disputed"
  | "completed"
  | "cancelled";
export type ChallengeStatus = "open" | "accepted" | "expired" | "cancelled";
export type OpponentMode = "open" | "invite";
export type CurrencyCode = "USDC";

export interface Game {
  id: string;
  name: string;
  type: GameType;
  studio_id: string | null;
  description: string | null;
  website_url: string | null;
  integration_status: GameIntegrationStatus;
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
  accepted_at?: string | null;
  expires_at?: string | null;
  rules?: string | null;
  currency?: CurrencyCode;
  started_at?: string | null;
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

export interface MatchAuditEvent {
  id: string;
  match_id: string | null;
  challenge_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  tx_hash: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  studio_id?: string | null;
  slug?: string | null;
  description?: string | null;
  website_url?: string | null;
  integration_status?: "draft" | "submitted" | "sandbox" | "published" | "rejected" | "suspended";
}

export type StudioStatus = "pending_payment" | "pending_review" | "approved" | "rejected" | "suspended";

export interface Studio {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  website_url: string | null;
  contact_email: string | null;
  status: StudioStatus;
  listing_fee_amount: string;
  listing_fee_currency: "USDC";
  created_at: string;
  updated_at: string;
}

export type GuildRole = "owner" | "officer" | "member";
export type GuildJoinPolicy = "open" | "approval" | "invite";
export type GuildProposalType = "strategy" | "treasury" | "membership";
export type GuildProposalStatus = "active" | "passed" | "rejected" | "executed" | "cancelled";
export type GuildVoteChoice = "for" | "against" | "abstain";

export interface Guild {
  id: string;
  name: string;
  slug: string;
  description: string;
  emblem: string;
  owner_user_id: string;
  join_policy: GuildJoinPolicy;
  treasury_balance: string;
  season_influence: number;
  created_at: string;
  updated_at: string;
  member_count?: number;
  current_user_role?: GuildRole | null;
}

export interface GuildProposal {
  id: string;
  guild_id: string;
  proposer_user_id: string;
  title: string;
  description: string;
  proposal_type: GuildProposalType;
  amount: string | null;
  status: GuildProposalStatus;
  closes_at: string;
  created_at: string;
  votes_for?: number;
  votes_against?: number;
  votes_abstain?: number;
  current_user_vote?: GuildVoteChoice | null;
}
