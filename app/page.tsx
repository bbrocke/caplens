import {
  DISPLAY_SEASON,
  formatMoney,
  fetchPlayers,
  computeTeamBreakdown,
  clampPercent,
  isOnActiveRoster,
} from "@/lib/players";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { players: allPlayers, error } = await fetchPlayers();

  if (error) {
    return <main className="p-8 text-red-500">Error: {error}</main>;
  }

  const players = allPlayers.filter(isOnActiveRoster);
  const amountsComplete = players.length > 0 && players.every((player) => player.capHit !== null);
  const teamBreakdown = amountsComplete ? computeTeamBreakdown(players) : [];

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="text-4xl font-bold">CapLens</h1>
      <p className="mt-2 text-slate-400">
        NHL Contract Comparison Tool · {DISPLAY_SEASON}
      </p>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-2xl font-bold">Gross Roster Contract Totals</h2>
        <p className="mt-2 text-sm text-slate-400">
          Loaded player cap hits versus the $104M Upper Limit. This is not
          official cap-space accounting and excludes adjustments such as LTIR,
          retained salary, and dead cap. Missing or ambiguous season contracts are excluded; totals may be incomplete. Team assignments reflect the loaded roster, not a verified historical snapshot.
        </p>

        {!amountsComplete && <p className="mt-4 text-amber-200">Team totals are unavailable while season amounts are being verified. Compare individual verified contracts on the comparison page.</p>}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {teamBreakdown.map((team) => (
            <div
              key={team.team}
              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{team.team}</h3>
                <span className="text-sm text-slate-400">
                  {team.usedPercent}% of limit
                </span>
              </div>

              <div className="mt-4 rounded-full bg-slate-800">
                <div
                  className="h-3 rounded-full bg-emerald-400"
                  style={{ width: `${clampPercent(team.usedPercent)}%` }}
                />
              </div>

              <div className="mt-4 space-y-1 text-sm text-slate-300">
                <p>Gross loaded hit: ${team.usedCap.toLocaleString()}</p>
                <p>
                  Upper-limit difference: ${team.remainingCap.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {players.map((player) => (
          <div
            key={player.id}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{player.name}</h2>
              <span className="text-sm text-slate-400">{player.team}</span>
            </div>

            <p className="mt-2 text-2xl font-bold">
              {player.capPercent}{player.capHit !== null ? "%" : ""}
            </p>

            <p className="text-sm text-slate-400">
              of team cap
            </p>

            <div className="mt-4 h-3 rounded-full bg-slate-800">
              <div
                className="h-3 rounded-full bg-emerald-400"
                style={{ width: `${clampPercent(player.capPercent)}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <div className="mt-10 overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left">
          <thead className="bg-slate-900">
            <tr>
              <th className="p-4">Player</th>
              <th className="p-4">Team</th>
              <th className="p-4">Pos</th>
              <th className="p-4">Cap Hit</th>
              <th className="p-4">AAV</th>
              <th className="p-4">Cap %</th>
              <th className="p-4">Contract term (years)</th>
              <th className="p-4">Clause</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-t border-slate-800">
                <td className="p-4 font-medium">{player.name}</td>
                <td className="p-4">{player.team}</td>
                <td className="p-4">{player.position}</td>
                <td className="p-4">{formatMoney(player.capHit)}</td>
                <td className="p-4">{formatMoney(player.aav)}</td>
                <td className="p-4">{player.capPercent}{player.capHit !== null ? "%" : ""}</td>
                <td className="p-4">{player.years}</td>
                <td className="p-4">{player.clause}</td>
                <td className="p-4 capitalize">
                  {player.rosterNote}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
