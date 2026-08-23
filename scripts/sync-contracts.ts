import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { load } from "cheerio";
import { randomUUID } from "node:crypto";

loadEnvConfig(process.cwd());

const SOURCE_URL =
  "https://thestanleycap.com/transactions/active_contracts/20252026";
const SOURCE_SEASON = "2025-26";
const APPLY = process.argv.includes("--apply");

type SourceContract = {
  nhlPlayerId: number | null;
  playerName: string;
  position: string;
  team: string;
  startSeason: string;
  endSeason: string;
  years: number;
  totalValue: number;
  capHit: number;
  aav: number;
  clauseType: string;
  expiryStatus: string;
};

type PlayerRow = {
  id: string;
  nhl_player_id: number | null;
  full_name: string;
  position: string | null;
  season_status: string;
  teams: { id: string; abbreviation: string } | null;
};

type ExistingContract = {
  id: string;
  player_id: string;
  cap_status: string | null;
  end_season: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env.local.`);
  return value;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizePosition(value: string | null): string {
  const position = (value ?? "").toUpperCase();
  if (["LW", "RW", "L", "R"].includes(position)) return "W";
  if (["LD", "RD", "D"].includes(position)) return "D";
  return position;
}

function parseMoney(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "").toUpperCase();
  if (!cleaned || cleaned === "-" || cleaned === "NAN") return 0;
  const multiplier = cleaned.endsWith("M")
    ? 1_000_000
    : cleaned.endsWith("K")
      ? 1_000
      : 1;
  const numeric = Number(cleaned.replace(/[MK]$/, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : 0;
}

function normalizeStartSeason(value: string): string {
  const match = value.match(/^(\d{2})-(\d{2})$/);
  return match ? `20${match[1]}-${match[2]}` : value;
}

function normalizeEndSeason(value: string): string {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000) return value;
  return `${year - 1}-${String(year).slice(-2)}`;
}

async function fetchSourceContracts(): Promise<SourceContract[]> {
  const response = await fetch(SOURCE_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { "user-agent": "CapLens contract sync/0.1" },
  });
  if (!response.ok) {
    throw new Error(`Contract source returned HTTP ${response.status}.`);
  }

  const $ = load(await response.text());
  const contracts: SourceContract[] = [];

  $("table tbody tr").each((_, row) => {
    const cellElements = $(row).find("td").toArray();
    const cells = cellElements.map((cell) =>
      $(cell).text().replace(/\s+/g, " ").trim(),
    );
    if (cells.length < 14) return;

    const sortedValue = (index: number) =>
      $(cellElements[index]).attr("data-sort") || cells[index];
    const playerHref = $(cellElements[0]).find("a").attr("href") || "";
    const idMatch = playerHref.match(/-(\d+)$/);

    const [
      playerName,
      position,
      team,
      ,
      start,
      end,
      years,
      total,
      capHit,
      ,
      ,
      ,
      terms,
      expiry,
    ] = cells;

    if (!playerName || !team || !capHit) return;
    contracts.push({
      nhlPlayerId: idMatch ? Number(idMatch[1]) : null,
      playerName,
      position,
      team,
      startSeason: normalizeStartSeason(start),
      endSeason: normalizeEndSeason(end),
      years: Number(sortedValue(6)) || Number(years) || 0,
      totalValue: parseMoney(sortedValue(7) || total),
      capHit: parseMoney(sortedValue(8) || capHit),
      aav: parseMoney(sortedValue(8) || capHit),
      clauseType: terms && terms !== "-" ? terms : "None",
      expiryStatus: expiry && expiry !== "-" ? expiry : "Unknown",
    });
  });

  if (contracts.length < 500) {
    throw new Error(`Parsed only ${contracts.length} source rows; aborting.`);
  }
  return contracts;
}

function chunks<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    result.push(rows.slice(index, index + size));
  }
  return result;
}

function currentSeasonCandidate(
  candidates: SourceContract[],
): SourceContract[] {
  const eligible = candidates.filter(
    (candidate) => candidate.startSeason <= SOURCE_SEASON,
  );
  if (eligible.length === 0) return [];
  const latestStart = eligible
    .map((candidate) => candidate.startSeason)
    .sort()
    .at(-1);
  return eligible.filter((candidate) => candidate.startSeason === latestStart);
}

async function main() {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SECRET_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const [sourceContracts, playersResult, contractsResult] = await Promise.all([
    fetchSourceContracts(),
    supabase
      .from("players")
      .select("id, nhl_player_id, full_name, position, season_status, teams:team_id(id, abbreviation)"),
    supabase
      .from("contracts")
      .select("id, player_id, cap_status, end_season"),
  ]);

  if (playersResult.error) throw new Error(playersResult.error.message);
  if (contractsResult.error) throw new Error(contractsResult.error.message);

  const players = (playersResult.data ?? []) as unknown as PlayerRow[];
  const existingContracts =
    (contractsResult.data ?? []) as ExistingContract[];

  const sourceByKey = new Map<string, SourceContract[]>();
  const sourceByName = new Map<string, SourceContract[]>();
  const sourceByNhlId = new Map<number, SourceContract[]>();
  for (const contract of sourceContracts) {
    const key = `${normalizeName(contract.playerName)}|${contract.team}`;
    sourceByKey.set(key, [...(sourceByKey.get(key) ?? []), contract]);
    const nameKey = normalizeName(contract.playerName);
    sourceByName.set(nameKey, [
      ...(sourceByName.get(nameKey) ?? []),
      contract,
    ]);
    if (contract.nhlPlayerId) {
      sourceByNhlId.set(contract.nhlPlayerId, [
        ...(sourceByNhlId.get(contract.nhlPlayerId) ?? []),
        contract,
      ]);
    }
  }

  const existingByPlayer = new Map<string, ExistingContract[]>();
  for (const contract of existingContracts) {
    existingByPlayer.set(contract.player_id, [
      ...(existingByPlayer.get(contract.player_id) ?? []),
      contract,
    ]);
  }

  const matched: Array<{ player: PlayerRow; source: SourceContract }> = [];
  const unmatched: PlayerRow[] = [];
  const ambiguous: Array<{ player: PlayerRow; candidates: SourceContract[] }> = [];
  const teamFallbacks: Array<{ player: PlayerRow; source: SourceContract }> = [];
  let idMatches = 0;
  let nameFallbackMatches = 0;

  for (const player of players) {
    if (player.season_status !== "active" || !player.teams) continue;
    const idCandidates = player.nhl_player_id
      ? currentSeasonCandidate(sourceByNhlId.get(player.nhl_player_id) ?? [])
      : [];
    const idPositionMatches = idCandidates.filter(
      (candidate) =>
        normalizePosition(candidate.position) === normalizePosition(player.position),
    );
    let usable =
      idPositionMatches.length > 0 ? idPositionMatches : idCandidates;

    if (usable.length === 1) idMatches += 1;

    if (usable.length === 0) {
      const key = `${normalizeName(player.full_name)}|${player.teams.abbreviation}`;
      const exactTeamCandidates = currentSeasonCandidate(sourceByKey.get(key) ?? []);
      // Unlike the NHL-ID tier, a name/team match isn't a guaranteed identity
      // match (two different real players can share a name). If position
      // filtering rules out every candidate here, that's a signal we've
      // found a same-named-but-different player, not a data-entry quirk on
      // an otherwise-correct match — so we must NOT fall back to the
      // unfiltered set the way the ID tier safely can.
      usable = exactTeamCandidates.filter(
        (candidate) =>
          normalizePosition(candidate.position) === normalizePosition(player.position),
      );
    }

    if (usable.length === 0) {
      const nameCandidates = currentSeasonCandidate(
        sourceByName.get(normalizeName(player.full_name)) ?? [],
      );
      // Same reasoning as the name/team tier above: don't silently accept a
      // position-mismatched candidate for a bare name match, since that's
      // the tier most likely to collide across distinct same-named players.
      usable = nameCandidates.filter(
        (candidate) =>
          normalizePosition(candidate.position) === normalizePosition(player.position),
      );
    }

    if (usable.length === 1 && idCandidates.length === 0) {
      nameFallbackMatches += 1;
    }
    if (
      usable.length === 1 &&
      usable[0].team !== player.teams.abbreviation
    ) {
      teamFallbacks.push({ player, source: usable[0] });
    }

    if (usable.length === 1) matched.push({ player, source: usable[0] });
    else if (usable.length === 0) unmatched.push(player);
    else ambiguous.push({ player, candidates: usable });
  }

  const fetchedAt = new Date().toISOString();
  const rows = matched.map(({ player, source }) => {
    const existing = [...(existingByPlayer.get(player.id) ?? [])]
      .filter((contract) => !["ltir", "terminated"].includes(contract.cap_status ?? ""))
      .sort((a, b) =>
        (b.end_season ?? "").localeCompare(a.end_season ?? ""),
      )[0];

    return {
      id: existing?.id ?? randomUUID(),
      player_id: player.id,
      team_id: player.teams!.id,
      start_season: source.startSeason,
      end_season: source.endSeason,
      aav: source.aav,
      cap_hit: source.capHit,
      total_value: source.totalValue,
      years: source.years,
      contract_type: "Standard",
      expiry_status: source.expiryStatus,
      clause_type: source.clauseType,
      source_url: SOURCE_URL,
      updated_at: fetchedAt,
      cap_status: "active",
    };
  });

  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Source rows parsed: ${sourceContracts.length}`);
  console.log(`Active roster players checked: ${matched.length + unmatched.length + ambiguous.length}`);
  console.log(`Matched: ${matched.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  console.log(`Ambiguous: ${ambiguous.length}`);
  console.log(`NHL-ID matches: ${idMatches}`);
  console.log(`Name fallback matches: ${nameFallbackMatches}`);
  console.log(`Source-team drift records: ${teamFallbacks.length}`);
  console.log(
    `Unmatched sample: ${unmatched
      .slice(0, 25)
      .map((player) => `${player.full_name} (${player.teams?.abbreviation})`)
      .join(", ") || "none"}`,
  );
  if (ambiguous.length > 0) {
    console.log(
      `Ambiguous sample: ${ambiguous
        .slice(0, 10)
        .map(({ player }) => `${player.full_name} (${player.teams?.abbreviation})`)
        .join(", ")}`,
    );
  }
  if (teamFallbacks.length > 0) {
    console.log(
      `Team-drift sample: ${teamFallbacks
        .slice(0, 25)
        .map(
          ({ player, source }) =>
            `${player.full_name} (${player.teams?.abbreviation} roster / ${source.team || "unassigned"} source)`,
        )
        .join(", ")}`,
    );
  }

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to write matched contracts.");
    return;
  }

  if (ambiguous.length > 0) {
    throw new Error("Ambiguous matches found; refusing to write.");
  }
  if (matched.length < 500) {
    throw new Error(`Only ${matched.length} roster matches; refusing to write.`);
  }

  for (const batch of chunks(rows, 100)) {
    const { error } = await supabase.from("contracts").upsert(batch, {
      onConflict: "id",
    });
    if (error) throw new Error(`Contract upsert failed: ${error.message}`);
  }

  console.log(`Imported ${rows.length} reconciled ${SOURCE_SEASON} contracts.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
