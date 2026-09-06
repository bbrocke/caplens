import assert from "node:assert/strict";
import test from "node:test";
import { formatPlayer, isOnActiveRoster, type PlayerRow } from "../lib/players";
import roster from "../lib/current-roster-corrections.json";
import reported from "../lib/reported-contract-seasons.json";
import held from "../audits/2026-09-06/contracts-held-for-review.json";

const row = (id: number): PlayerRow => ({ id: String(id), nhl_player_id: id,
  full_name: "Fixture", position: "C", season_status: "active", teams: { abbreviation: "OLD", cap_limit: 95500000 },
  contracts: [{start_season: "2025-26", end_season: "2028-29", cap_hit: 4000000, aav: 4000000, years: 4, clause_type: "NMC", cap_status: "active"}],
});
test("all 14 team corrections are used without rewriting stored rows", () => {
  const changes = roster.filter((x) => !x.status);
  assert.equal(changes.length, 14);
  for (const change of changes) {
    const original = row(change.nhlPlayerId);
    assert.equal(formatPlayer(original).team, change.team);
    assert.equal(original.teams?.abbreviation, "OLD");
  }
});
test("retirement and overseas corrections filter current views but preserve history", () => {
  for (const change of roster.filter((x) => x.status === "retired" || x.status === "overseas")) {
    assert.equal(isOnActiveRoster(formatPlayer(row(change.nhlPlayerId), 2026)), false);
    assert.equal(isOnActiveRoster(formatPlayer(row(change.nhlPlayerId), 2025)), true);
  }
});
test("unsigned players never inherit an expired or bought-out cap amount", () => {
  for (const change of roster.filter((x) => x.status?.startsWith("unsigned"))) {
    const p = formatPlayer(row(change.nhlPlayerId));
    assert.equal(p.capHit, null);
    assert.equal(p.years, "Unknown");
    if (change.status === "unsigned_ufa") assert.equal(p.team, "Free agent");
  }
});
test("bulk sources stay distinguished from individual reviews and held amounts", () => {
  assert.ok(reported.length > 600);
  assert.equal(new Set(reported.map((x) => x.nhlPlayerId)).size, reported.length);
  for (const entry of reported) {
    const p = formatPlayer(row(entry.nhlPlayerId));
    assert.equal(p.capHit, entry.capHit);
    assert.equal(p.amountReview, "source");
    assert.equal(p.aav, null);
  }
  for (const entry of held) assert.equal(formatPlayer(row(entry.nhlPlayerId)).capHit, null);
  assert.deepEqual(held.map((entry) => entry.nhlPlayerId), [8477494]);
});
