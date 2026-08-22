import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const NHL_API_BASE_URL = "https://api-web.nhle.com/v1";
const DEFAULT_SEASON = "20252026";
const TEAM_ABBREVIATIONS = [
  "ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL",
  "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD",
  "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS",
  "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH",
] as const;

type LocalizedName = { default?: string };

type NhlPlayer = {
  id: number;
  firstName?: LocalizedName;
  lastName?: LocalizedName;
  positionCode?: string;
};

type NhlRoster = {
  forwards?: NhlPlayer[];
  defensemen?: NhlPlayer[];
  goalies?: NhlPlayer[];
};

type TeamRow = {
  id: string;
  abbreviation: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local before running the roster sync.`,
    );
  }
  return value;
}

async function fetchRoster(team: string, season: string): Promise<NhlRoster> {
  const response = await fetch(
    `${NHL_API_BASE_URL}/roster/${team}/${season}`,
    { signal: AbortSignal.timeout(15_000) },
  );

  if (!response.ok) {
    throw new Error(`${team}: NHL API returned HTTP ${response.status}`);
  }

  return (await response.json()) as NhlRoster;
}

function rosterPlayers(roster: NhlRoster): NhlPlayer[] {
  return [
    ...(roster.forwards ?? []),
    ...(roster.defensemen ?? []),
    ...(roster.goalies ?? []),
  ];
}

async function main() {
  const season = process.env.NHL_SEASON?.trim() || DEFAULT_SEASON;
  if (!/^\d{8}$/.test(season)) {
    throw new Error("NHL_SEASON must use the format 20252026.");
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecretKey = requiredEnv("SUPABASE_SECRET_KEY");
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .select("id, abbreviation")
    .in("abbreviation", [...TEAM_ABBREVIATIONS]);

  if (teamsError) throw new Error(`Could not load teams: ${teamsError.message}`);

  const teamIds = new Map(
    ((teamRows ?? []) as TeamRow[]).map((team) => [team.abbreviation, team.id]),
  );
  const missingTeams = TEAM_ABBREVIATIONS.filter((team) => !teamIds.has(team));
  if (missingTeams.length > 0) {
    throw new Error(
      `Missing teams in Supabase: ${missingTeams.join(", ")}. Run scripts/prepare-roster-sync.sql first.`,
    );
  }

  let savedPlayers = 0;
  const failures: string[] = [];

  for (const abbreviation of TEAM_ABBREVIATIONS) {
    try {
      const roster = await fetchRoster(abbreviation, season);
      const players = rosterPlayers(roster).map((player) => ({
        nhl_player_id: player.id,
        full_name: [player.firstName?.default, player.lastName?.default]
          .filter(Boolean)
          .join(" "),
        position: player.positionCode ?? null,
        team_id: teamIds.get(abbreviation)!,
        season_status: "active",
      }));

      if (players.length === 0) {
        throw new Error("NHL API returned an empty roster");
      }

      const { error } = await supabase
        .from("players")
        .upsert(players, { onConflict: "nhl_player_id" });

      if (error) throw new Error(error.message);

      savedPlayers += players.length;
      console.log(`${abbreviation}: saved ${players.length} players`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${abbreviation}: ${message}`);
      console.error(`${abbreviation}: failed - ${message}`);
    }
  }

  console.log(`Roster sync complete: ${savedPlayers} player records saved.`);

  if (failures.length > 0) {
    throw new Error(`Roster sync had ${failures.length} failed team(s).`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
