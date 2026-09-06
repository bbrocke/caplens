import { getSupabase } from "@/lib/supabaseClient";

// 2025–26 Upper Limit, matching the season and limit shown on the dashboard.
// Used only when a team's cap_limit isn't set in the database.
export const DISPLAY_SEASON = "2025–26";
export const SEASON_START = 2025;
const FALLBACK_TEAM_CAP = 95_500_000;

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
  clause: string;
  capPercent: string;
  seasonStatus: SeasonStatus;
  capStatus: CapStatus;
};

export type SeasonStatus = "active" | "inactive" | "retired" | "deceased";
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

type PlayerRow = {
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

export function currentContract(contracts: ContractRow[] | null): ContractRow | null {
  const matches = (contracts || []).filter((contract) => {
    const start = seasonStart(contract.start_season);
    const end = seasonStart(contract.end_season);
    return start !== null && end !== null && start <= SEASON_START && end >= SEASON_START;
  });
  // Overlapping records are ambiguous; do not silently pick one.
  return matches.length === 1 ? matches[0] : null;
}

export function formatMoney(value: number | null): string {
  return value === null ? "Unknown" : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(value);
}

function formatPlayer(row: PlayerRow): Player {
  const contract = currentContract(row.contracts);
  const teamCapLimit = row.teams?.cap_limit || FALLBACK_TEAM_CAP;
  const capHit = contract?.cap_hit == null ? null : Number(contract.cap_hit);

  return {
    id: row.id,
    name: row.full_name,
    team: row.teams?.abbreviation || "-",
    teamCapLimit,
    position: row.position || "-",
    capHit,
    aav: contract?.aav == null ? null : Number(contract.aav),
    years: contract?.years ?? "Unknown",
    yearsRemaining: contract ? seasonStart(contract.end_season)! - SEASON_START + 1 : "Unknown",
    contractPeriod: contract ? `${contract.start_season} – ${contract.end_season}` : "No unique dated contract for this season",
    clause: contract?.clause_type || "Unknown",
    capPercent: capHit === null ? "Unknown" : ((capHit / teamCapLimit) * 100).toFixed(1),
    seasonStatus: row.season_status || "active",
    capStatus: contract?.cap_status || (contract ? "unknown" : "none"),
  };
}

export async function fetchPlayers(): Promise<{
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
    players: ((data as unknown as PlayerRow[]) || []).map(formatPlayer),
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
