import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SOURCE_URL =
  "https://thestanleycap.com/transactions/active_contracts/20252026";

type Player = {
  id: string;
  nhl_player_id: number | null;
  full_name: string;
  season_status: string;
  teams: { id: string; abbreviation: string; cap_limit: number | null } | null;
};

type Contract = {
  id: string;
  player_id: string;
  team_id: string | null;
  cap_hit: number | null;
  aav: number | null;
  total_value: number | null;
  years: number | null;
  start_season: string | null;
  end_season: string | null;
  cap_status: string | null;
  source_url: string | null;
  updated_at: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env.local.`);
  return value;
}

function assertCheck(condition: boolean, message: string, failures: string[]) {
  if (condition) console.log(`PASS  ${message}`);
  else {
    console.error(`FAIL  ${message}`);
    failures.push(message);
  }
}

async function main() {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const [playersResult, contractsResult] = await Promise.all([
    supabase
      .from("players")
      .select(
        "id, nhl_player_id, full_name, season_status, teams:team_id(id, abbreviation, cap_limit)",
      ),
    supabase
      .from("contracts")
      .select(
        "id, player_id, team_id, cap_hit, aav, total_value, years, start_season, end_season, cap_status, source_url, updated_at",
      ),
  ]);
  if (playersResult.error) throw new Error(playersResult.error.message);
  if (contractsResult.error) throw new Error(contractsResult.error.message);

  const players = (playersResult.data ?? []) as unknown as Player[];
  const contracts = (contractsResult.data ?? []) as Contract[];
  const activePlayers = players.filter((player) => player.season_status === "active");
  const activeContracts = contracts.filter(
    (contract) => contract.cap_status === "active",
  );
  const playerIds = new Set(players.map((player) => player.id));
  const nhlIds = activePlayers
    .map((player) => player.nhl_player_id)
    .filter((id): id is number => id !== null);
  const activeByPlayer = new Map<string, Contract[]>();
  for (const contract of activeContracts) {
    activeByPlayer.set(contract.player_id, [
      ...(activeByPlayer.get(contract.player_id) ?? []),
      contract,
    ]);
  }

  const failures: string[] = [];
  assertCheck(players.length === 704, "704 reconciled player records", failures);
  assertCheck(activePlayers.length === 702, "702 active 2025-26 roster players", failures);
  assertCheck(
    nhlIds.length === activePlayers.length && new Set(nhlIds).size === nhlIds.length,
    "every active player has one unique NHL player ID",
    failures,
  );
  assertCheck(activeContracts.length === 702, "702 active contract records", failures);
  assertCheck(
    activePlayers.every((player) => (activeByPlayer.get(player.id) ?? []).length === 1),
    "every active player has exactly one active contract",
    failures,
  );
  assertCheck(
    contracts.every((contract) => playerIds.has(contract.player_id)),
    "no orphaned contract records",
    failures,
  );
  assertCheck(
    activePlayers.every((player) => {
      const contract = activeByPlayer.get(player.id)?.[0];
      return Boolean(contract && player.teams && contract.team_id === player.teams.id);
    }),
    "every active contract is assigned to its season-roster team",
    failures,
  );
  assertCheck(
    activeContracts.every(
      (contract) =>
        Number(contract.cap_hit) > 0 &&
        Number(contract.aav) > 0 &&
        Number(contract.total_value) > 0 &&
        Number(contract.years) > 0,
    ),
    "all active financial and term values are positive",
    failures,
  );
  assertCheck(
    activeContracts.every(
      (contract) =>
        contract.source_url === SOURCE_URL && Boolean(contract.updated_at),
    ),
    "all active contracts carry source provenance and fetch time",
    failures,
  );
  assertCheck(
    new Set(activePlayers.map((player) => player.teams?.abbreviation)).size === 32,
    "all 32 NHL teams are represented",
    failures,
  );

  const totals = new Map<string, { players: number; capHit: number; limit: number }>();
  for (const player of activePlayers) {
    const team = player.teams?.abbreviation;
    const contract = activeByPlayer.get(player.id)?.[0];
    if (!team || !contract) continue;
    const current = totals.get(team) ?? {
      players: 0,
      capHit: 0,
      limit: Number(player.teams?.cap_limit ?? 0),
    };
    current.players += 1;
    current.capHit += Number(contract.cap_hit ?? 0);
    totals.set(team, current);
  }

  console.log("\nTeam gross roster-contract totals (not formal Upper Limit accounting):");
  for (const [team, total] of [...totals].sort(([a], [b]) => a.localeCompare(b))) {
    const percent = total.limit > 0 ? (total.capHit / total.limit) * 100 : 0;
    console.log(
      `${team.padEnd(3)}  ${String(total.players).padStart(2)} players  $${(
        total.capHit / 1_000_000
      ).toFixed(3)}M  ${percent.toFixed(1)}%`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} validation check(s) failed.`);
  }
  console.log("\nValidation complete: all integrity checks passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
