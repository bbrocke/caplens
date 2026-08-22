import { getSupabase } from "@/lib/supabaseClient";

// Used only when a team's cap_limit isn't set in the database.
const FALLBACK_TEAM_CAP = 83_500_000;

export type Player = {
  id: string;
  name: string;
  team: string;
  teamCapLimit: number;
  position: string;
  capHit: number;
  aav: number;
  years: number | string;
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

type ContractRow = {
  cap_hit: number | null;
  aav: number | null;
  years: number | null;
  clause_type: string | null;
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
    end_season
    ,cap_status
  )
`;

// Picks the contract with the latest end_season, since a player can have
// past contracts on record and Supabase doesn't guarantee row order here.
function currentContract(contracts: ContractRow[] | null): ContractRow | null {
  if (!contracts || contracts.length === 0) return null;

  return [...contracts].sort((a, b) =>
    (b.end_season || "").localeCompare(a.end_season || "")
  )[0];
}

function formatPlayer(row: PlayerRow): Player {
  const contract = currentContract(row.contracts);
  const teamCapLimit = row.teams?.cap_limit || FALLBACK_TEAM_CAP;
  const capHit = Number(contract?.cap_hit || 0);

  return {
    id: row.id,
    name: row.full_name,
    team: row.teams?.abbreviation || "-",
    teamCapLimit,
    position: row.position || "-",
    capHit,
    aav: Number(contract?.aav || 0),
    years: contract?.years ?? "-",
    clause: contract?.clause_type || "None",
    capPercent: ((capHit / teamCapLimit) * 100).toFixed(1),
    seasonStatus: row.season_status || "active",
    capStatus: contract?.cap_status || (contract ? "unknown" : "none"),
  };
}

export async function fetchPlayers(): Promise<{
  players: Player[];
  error: string | null;
}> {
  const { data, error } = await getSupabase()
    .from("players")
    .select(PLAYERS_QUERY);

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

    acc[player.team].usedCap += player.capHit;
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
