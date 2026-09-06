import assert from "node:assert/strict";
import test from "node:test";
import { currentContract, seasonStart, formatMoney, type ContractRow } from "../lib/players";

const contract = (start: string | null, end: string | null): ContractRow => ({
  start_season: start, end_season: end, cap_hit: 950000, aav: 950000,
  years: 3, clause_type: null, cap_status: "active",
});
test("selects the season contract instead of a future extension", () => {
  const active = contract("2023-24", "2025-26");
  const future = contract("2026-27", "2033-34");
  assert.equal(currentContract([future, active]), active);
  assert.equal(currentContract([active, future]), active);
});
test("includes the first and final season", () => {
  const first = contract("2025-26", "2027-28");
  const last = contract("2023-24", "2025-26");
  assert.equal(currentContract([first]), first);
  assert.equal(currentContract([last]), last);
});
test("does not guess for missing, expired, malformed or overlapping dates", () => {
  for (const rows of [null, [], [contract(null, "2026-27")],
    [contract("2020-21", "2024-25")], [contract("2026-27", "2030-31")],
    [contract("2025-99", "2027-28")],
    [contract("2024-25", "2026-27"), contract("2025-26", "2027-28")]]) {
    assert.equal(currentContract(rows), null);
  }
});
test("accepts valid season formats and distinguishes unknown amounts from zero", () => {
  assert.equal(seasonStart("2025–26"), 2025);
  assert.equal(seasonStart("2025-2026"), 2025);
  assert.equal(seasonStart("20252026"), null);
  assert.equal(formatMoney(null), "Unknown");
  assert.equal(formatMoney(0), "$0");
});
