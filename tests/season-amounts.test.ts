import assert from "node:assert/strict";
import test from "node:test";
import { formatPlayer, type PlayerRow } from "../lib/players";
import verified from "../lib/verified-contract-seasons.json";

const player = (id: number): PlayerRow => ({
  id: "test", nhl_player_id: id, full_name: "Fixture", position: "C",
  season_status: "active", teams: { abbreviation: "UTA", cap_limit: 95500000 },
  contracts: [{ start_season: "2025-26", end_season: "2026-27", years: 2,
    cap_hit: 775000, aav: 775000, cap_status: "active", clause_type: null }],
});

test("current amounts override old summaries without mutating historical records", () => {
  const row = player(8481827);
  const before = structuredClone(row);
  const current = formatPlayer(row, 2026);
  assert.equal(current.capHit, 850000);
  assert.equal(current.teamCapLimit, 104000000);
  assert.equal(current.yearsRemaining, 1);
  assert.equal(current.capPercent, "0.8");
  assert.equal(formatPlayer(row, 2025).capHit, 775000);
  assert.equal(formatPlayer(row, 2025).teamCapLimit, 95500000);
  assert.deepEqual(row, before);
});

test("new deals work when the database only has the expired contract", () => {
  const row = player(8481019);
  row.contracts![0].end_season = "2025-26";
  const current = formatPlayer(row, 2026);
  assert.equal(current.capHit, 850000);
  assert.equal(current.years, 1);
  assert.equal(current.contractPeriod, "2026-27 – 2026-27");
  assert.equal(current.clause, "Unknown");
  assert.equal(current.capStatus, "unknown");
});

test("unreviewed current amounts do not inherit historical summaries", () => {
  assert.equal(formatPlayer(player(123), 2026).capHit, null);
  assert.equal(formatPlayer(player(123), 2026).aav, null);
  assert.equal(formatPlayer(player(123), 2026).capPercent, "Unknown");
});

test("bonus-inclusive AAV, entry-level term and remaining seasons stay distinct", () => {
  const oskar = formatPlayer(player(8483673), 2026);
  assert.equal(oskar.capHit, 910000);
  assert.equal(oskar.aav, 945000);
  assert.equal(oskar.years, 3);
  assert.equal(oskar.yearsRemaining, 1);
  const jake = formatPlayer(player(8486169), 2026);
  assert.equal(jake.capHit, 975000);
  assert.equal(jake.aav, 1100000);
  assert.equal(formatPlayer(player(8477435), 2026).yearsRemaining, 3);
  assert.equal(formatPlayer(player(8479656), 2026).capHit, 812500);
});

test("reviewed dataset has ten unique sourced player-season records", () => {
  assert.equal(verified.length, 10);
  assert.equal(new Set(verified.map((row) => `${row.nhlPlayerId}:${row.season}`)).size, 10);
  for (const row of verified) {
    assert.equal(row.season, 2026);
    assert.ok(row.capHit > 0);
    assert.ok(row.source.startsWith("https://puckpedia.com/player/"));
  }
});
