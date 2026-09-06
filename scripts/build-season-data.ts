// Rebuild a reviewable snapshot; never writes to Supabase.
import { readFileSync, writeFileSync } from "node:fs";
import candidates from "../audits/2026-09-06/contract-source-candidates.json";
import reviewed from "../lib/verified-contract-seasons.json";
import corrections from "../lib/current-roster-corrections.json";

const excludedIds = new Set(corrections.filter((x) => x.status).map((x) => x.nhlPlayerId));
const reviewedIds = new Set(reviewed.map((x) => x.nhlPlayerId));
const unique = new Set<number>();
const accepted: typeof candidates = [];
const held: { name: string; nhlPlayerId: number; reason: string }[] = [];
for (const row of candidates) {
  if (unique.has(row.nhlPlayerId)) throw new Error(`Duplicate candidate ${row.nhlPlayerId}`);
  unique.add(row.nhlPlayerId);
  if (reviewedIds.has(row.nhlPlayerId)) continue;
  const span = Number(row.endSeason.slice(0, 4)) - Number(row.startSeason.slice(0, 4)) + 1;
  const reason = excludedIds.has(row.nhlPlayerId) ? "Unsigned, retired or overseas status supersedes source"
    : !Number.isSafeInteger(row.capHit) || row.capHit < 850000 ? "Minimum-salary/season adjustment needs individual review"
    : span !== row.termYears ? "Term and date span differ; possible ELC slide"
    : "";
  if (reason) held.push({ name: row.name, nhlPlayerId: row.nhlPlayerId, reason });
  else accepted.push(row);
}
writeFileSync("lib/reported-contract-seasons.json", JSON.stringify(accepted.map(({ verifiedAt, ...row }) => ({ ...row, fetchedAt: verifiedAt })), null, 2) + "\n");
writeFileSync("audits/2026-09-06/contracts-held-for-review.json", JSON.stringify(held, null, 2) + "\n");
const audit = JSON.parse(readFileSync("audits/2026-09-06/audit.json", "utf8"));
audit.expansion = { date: "2026-09-06", reviewed: reviewed.length, sourceReported: accepted.length,
  held: held.length, productionApplied: false,
  note: "Bulk source records are not independently verified. Four known amount conflicts use reviewed overrides. Ambiguous OEL and missing Metsa were individually resolved. No new players imported." };
writeFileSync("audits/2026-09-06/audit.json", JSON.stringify(audit, null, 2) + "\n");
console.log(audit.expansion);
