import reportedSeasons from "./reported-contract-seasons.json";
import rosterCorrections from "./current-roster-corrections.json";
import verifiedSeasons from "./verified-contract-seasons.json";
import { getSupabase } from "@/lib/supabaseClient";

export const DISPLAY_SEASON = "2026–27";
export const SEASON_START = 2026;
export const SEASON_CAPS: Record<number, number> = { 2025: 95_500_000, 2026: 104_000_000 };

export type Player = {
  id: string;
  name: string;
  team: string;
  teamCapLimit: number;
  position: string;
  capHit: number | null;
  aav: number | null;
  years: number | string;
  yearsRemaining: number | string;
  contractPeriod: string;
  amountSource: string | null;
  amountReview: "individual" | "source" | "historical" | "unknown";
  rosterNote: string;
  clause: string;
  capPercent: string;
  seasonStatus: SeasonStatus;
  capStatus: CapStatus;
};

export type SeasonStatus = "active" | "inactive" | "retired" | "deceased" | "overseas";
export type CapStatus =
  | "active"
  | "ltir"
  | "inactive"
  | "terminated"
  | "expired"
  | "unknown"
  | "none";

export type TeamBreakdown = {
  team: string;
  usedCap: number;
  teamCapLimit: number;
  remainingCap: number;
  usedPercent: string;
};

export type ContractRow = {
  cap_hit: number | null;
  aav: number | null;
  years: number | null;
  clause_type: string | null;
  start_season: string | null;
  end_season: string | null;
  cap_status: Exclude<CapStatus, "none"> | null;
};

export type PlayerRow = {
  nhl_player_id?: number | null;
  id: string;
  full_name: string;
  position: string | null;
  season_status: SeasonStatus | null;
  teams: { abbreviation: string; cap_limit: number | null } | null;
  contracts: ContractRow[] | null;
};

const PLAYERS_QUERY = `
  id,
  full_name,
  nhl_player_id,
  position,
  season_status,
  teams:team_id (
    abbreviation,
    cap_limit
  ),
  contracts (
    cap_hit,
    aav,
    years,
    clause_type,
    start_season,
    end_season,
    cap_status
  )
`;

// Invalid or missing dates cannot establish which season a contract covers.
export function seasonStart(value: string | null): number | null {
  const match = value?.match(/^(\d{4})[-–](\d{2}|\d{4})$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end === (match[2].length === 2 ? (start + 1) % 100 : start + 1) ? start : null;
}

export function currentContract(contracts: ContractRow[] | null, season = SEASON_START): ContractRow | null {
  const matches = (contracts || []).filter((contract) => {
    const start = seasonStart(contract.start_season);
    const end = seasonStart(contract.end_season);
    return start !== null && end !== null && start <= season && end >= season;
  });
  // Overlapping records are ambiguous; do not silently pick one.
  return matches.length === 1 ? matches[0] : null;
}

export function formatMoney(value: number | null): string {
  return value === null ? "Unknown" : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(value);
}

export function formatPlayer(row: PlayerRow, season = SEASON_START): Player {
  const correction = rosterCorrections.find((entry) => entry.nhlPlayerId === row.nhl_player_id);
  const status = season === 2026 ? correction?.status : null;
  const noCurrentContract = Boolean(status);
  const contract = noCurrentContract ? null : currentContract(row.contracts, season);
  const verified = verifiedSeasons.filter((entry) => entry.nhlPlayerId === row.nhl_player_id && entry.season === season);
  const reported = reportedSeasons.filter((entry) => entry.nhlPlayerId === row.nhl_player_id && entry.season === season);
  const amounts = noCurrentContract ? null : verified.length === 1 ? verified[0] : verified.length === 0 && reported.length === 1 ? reported[0] : null;
  // Database amounts were imported as contract summaries for 2025–26 only.
  // Never carry them forward into an unverified season.
  const metadata = amounts && (contract?.start_season !== amounts.startSeason || contract?.end_season !== amounts.endSeason) ? null : contract;
  const legacy = season === 2025 ? contract : null;
  const capHit = amounts?.capHit ?? (legacy?.cap_hit == null ? null : Number(legacy.cap_hit));
  const start = amounts?.startSeason ?? contract?.start_season;
  const end = amounts?.endSeason ?? contract?.end_season;
  const teamCapLimit = SEASON_CAPS[season];
  if (!teamCapLimit) throw new Error(`Unsupported contract season: ${season}`);
  return {
    id: row.id,
    name: row.full_name,
    team: correction ? correction.team ?? "Free agent" : row.teams?.abbreviation || "-",
    teamCapLimit,
    position: row.position || "-",
    capHit,
    aav: amounts?.aav ?? (legacy?.aav == null ? null : Number(legacy.aav)),
    years: amounts?.termYears ?? contract?.years ?? "Unknown",
    yearsRemaining: end && seasonStart(end) !== null ? seasonStart(end)! - season + 1 : "Unknown",
    contractPeriod: start && end ? `${start} – ${end}` : "No unique dated contract for this season",
    amountSource: amounts?.source ?? null,
    amountReview: amounts ? (verified.length === 1 ? "individual" : "source") : legacy ? "historical" : "unknown",
    rosterNote: status === "unsigned_rfa" ? "Unsigned RFA · team retains NHL rights"
      : status === "unsigned_ufa" ? "Unrestricted free agent"
      : status === "overseas" ? "Playing overseas · NHL rights retained separately"
      : status === "retired" ? "Retired"
      : amounts ? "Under contract · NHL roster slot unverified" : "Roster status unverified",
    clause: metadata?.clause_type || "Unknown",
    capPercent: capHit === null ? "Unknown" : ((capHit / teamCapLimit) * 100).toFixed(1),
    seasonStatus: status === "retired" || status === "overseas" ? status : row.season_status || "active",
    // A verified contract establishes amounts, not an active NHL roster slot.
    capStatus: metadata?.cap_status || (amounts || contract ? "unknown" : "none"),
  };
}

export async function fetchPlayers(season = SEASON_START): Promise<{
  players: Player[];
  error: string | null;
}> {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { players: [], error: message };
  }

  const { data, error } = await supabase.from("players").select(PLAYERS_QUERY);

  if (error) {
    return { players: [], error: error.message };
  }

  return {
    players: ((data as unknown as PlayerRow[]) || []).map((row) => formatPlayer(row, season)),
    error: null,
  };
}

export function computeTeamBreakdown(players: Player[]): TeamBreakdown[] {
  const byTeam = players.reduce<Record<string, TeamBreakdown>>((acc, player) => {
    if (player.seasonStatus !== "active" || player.capStatus !== "active") {
      return acc;
    }
    if (!acc[player.team]) {
      acc[player.team] = {
        team: player.team,
        usedCap: 0,
        teamCapLimit: player.teamCapLimit,
        remainingCap: 0,
        usedPercent: "0.0",
      };
    }

    acc[player.team].usedCap += player.capHit ?? 0;
    return acc;
  }, {});

  return Object.values(byTeam).map((team) => ({
    ...team,
    remainingCap: team.teamCapLimit - team.usedCap,
    usedPercent: ((team.usedCap / team.teamCapLimit) * 100).toFixed(1),
  }));
}

// Players who are no longer on a current NHL roster (retired, deceased, etc.)
// shouldn't appear in roster/comparison views.
export function isOnActiveRoster(player: Player): boolean {
  return player.seasonStatus === "active";
}

// Clamps a percent value (string or number) to [0, 100] for use as a CSS width.
export function clampPercent(percent: string | number): number {
  const value = typeof percent === "string" ? Number(percent) : percent;
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
