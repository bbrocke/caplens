"use client";

import { useEffect, useState } from "react";
import { SEASON_START, formatMoney, fetchPlayers, isOnActiveRoster, type Player } from "@/lib/players";
import {
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

const PAGE_SIZE = 12;
const COLORS = ["#34d399", "#a78bfa", "#38bdf8"];
const compactMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);

export default function ComparePage() {
  const [season, setSeason] = useState(SEASON_START);
  const displaySeason = `${season}–${String(season + 1).slice(-2)}`;
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("");
  const [position, setPosition] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPlayers(season).then(({ players, error }) => {
      if (cancelled) return;
      setPlayers(players.filter(isOnActiveRoster));
      setError(error);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError("Unable to load players. Please refresh and try again.");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [season]);

  const togglePlayer = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const selectedPlayers = selected.flatMap((id) =>
    players.filter((player) => player.id === id)
  );
  const teams = [...new Set(players.map((p) => p.team))].sort();
  const positions = [...new Set(players.map((p) => p.position))].sort();
  const filteredPlayers = players.filter((player) =>
    (!team || player.team === team) &&
    (!position || player.position === position) &&
    `${player.name} ${player.team} ${player.position}`
      .toLowerCase().includes(search.trim().toLowerCase())
  );
  const pageCount = Math.ceil(filteredPlayers.length / PAGE_SIZE);
  const visiblePlayers = filteredPlayers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-slate-950 px-4 py-6 text-white sm:p-8">
      <h1 className="text-4xl font-bold">Compare Players</h1>

      {error && (
        <p className="mt-4 text-red-500">Error: {error}</p>
      )}

      {loading && (
        <p className="mt-4 text-slate-400">Loading players…</p>
      )}

      <p className="mt-2 text-slate-400">Contract season: {displaySeason}. Choose up to three players to compare.</p>
      <label className="mt-4 block text-sm">Contract season
        <select value={season} onChange={(event) => {
          setSeason(Number(event.target.value)); setLoading(true); setError(null); setPlayers([]); setPage(0);
        }} className="ml-3 min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3">
          <option value={2026}>2026–27</option>
          <option value={2025}>2025–26</option>
        </select>
      </label>
      <p className="mt-2 text-sm text-slate-400">
        {season === 2026 ? "Current-season amounts are available for 10 verified contracts. Other amounts show Unknown until reviewed." : "Historical amounts are from the original import and remain under review."}
        {" "}Team labels reflect the loaded roster, not historical assignments.
      </p>
      <section aria-label="Selected players" className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Selected ({selected.length}/3)</h2>
          {selected.length > 0 && <button className="min-h-11 underline" onClick={() => setSelected([])}>Clear all</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedPlayers.map((player, index) => (
            <button key={player.id} onClick={() => togglePlayer(player.id)}
              aria-label={`Remove ${player.name}`}
              className="min-h-11 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: COLORS[index] }}>
              {player.name} ×
            </button>
          ))}
        </div>
        <p role="status" className="mt-2 text-sm text-slate-400">
          {selected.length === 3 ? "Three players selected. Remove one to add another." :
            selected.length === 0 ? "Search below to add your first player." : "Your selections stay here when you filter results."}
        </p>
      </section>

      <section aria-label="Find players" className="mt-6">
        <label htmlFor="player-search" className="text-sm font-medium">Search players</label>
        <input id="player-search" type="search" placeholder="Name, team, or position"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 focus-visible:outline-emerald-400" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm">Team
            <select value={team} onChange={(e) => { setTeam(e.target.value); setPage(0); }}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-2">
              <option value="">All teams</option>
              {teams.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm">Position
            <select value={position} onChange={(e) => { setPosition(e.target.value); setPage(0); }}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-2">
              <option value="">All positions</option>
              {positions.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
        {!loading && !error && <>
          <p role="status" className="my-3 text-sm text-slate-400">
            {filteredPlayers.length === 0 ? "No players match. Try another search or filter." :
              `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filteredPlayers.length)} of ${filteredPlayers.length} players`}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visiblePlayers.map((player) => (
              <button key={player.id} onClick={() => togglePlayer(player.id)}
                aria-pressed={selected.includes(player.id)}
                disabled={selected.length === 3 && !selected.includes(player.id)}
                className={`min-h-14 rounded-lg border p-3 text-left text-sm disabled:opacity-40 ${selected.includes(player.id) ? "border-emerald-400 bg-emerald-950" : "border-slate-700 bg-slate-900"}`}>
                <span className="block font-medium">{player.name}</span>
                <span className="text-slate-400">{player.team} · {player.position}</span>
              </button>
            ))}
          </div>
          {pageCount > 1 && <div className="mt-3 flex items-center justify-between gap-2">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="min-h-11 rounded-lg border border-slate-700 px-4 disabled:opacity-40">Previous</button>
            <span className="text-sm text-slate-400">{page + 1} / {pageCount}</span>
            <button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)} className="min-h-11 rounded-lg border border-slate-700 px-4 disabled:opacity-40">Next</button>
          </div>}
        </>}
      </section>

      {/* Comparison grid */}
      {selectedPlayers.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {selectedPlayers.map((p, index) => (
            <div
              key={p.id}
              className="rounded-2xl border bg-slate-900 p-4 sm:p-6"
              style={{ borderColor: COLORS[index] }}
            >
              <h2 className="text-xl font-bold">{p.name}</h2>
              <p className="text-slate-400">{p.team}</p>

              <div className="mt-4 space-y-2">
                <p>Cap Hit: {formatMoney(p.capHit)}</p>
                <p>AAV (may include performance bonuses): {formatMoney(p.aav)}</p>
                {p.amountSource && <a className="block text-sm underline" href={p.amountSource} target="_blank" rel="noreferrer">Verified season breakdown</a>}
                <p>Cap %: {p.capPercent}{p.capHit !== null ? "%" : ""}</p>
                <p>Contract term: {p.years} years</p>
                <p>Seasons remaining: {p.yearsRemaining}</p>
                <p className="text-xs text-slate-400">Includes {displaySeason}; measured at season start.</p>
                <p className="text-sm text-slate-400">{p.contractPeriod}</p>
                <p>Clause: {p.clause}</p>
                <p className="capitalize">
                  Status: {p.seasonStatus === "active" ? p.capStatus : p.seasonStatus}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bar chart */}
      {selectedPlayers.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-6">
          <h2 className="mb-2 text-xl font-bold">Cap Hit Comparison · {displaySeason}</h2>
          <p className="mb-4 text-sm text-slate-400">Unknown cap hits are omitted from the chart.</p>

          <div className="h-72 w-full">
            <ResponsiveContainer>
              <BarChart data={selectedPlayers.map((p, index) => ({ ...p, color: COLORS[index] })).filter((p) => p.capHit !== null)} margin={{ top: 24, right: 8, left: 0, bottom: 24 }}>
                <XAxis dataKey="name" stroke="#94a3b8" interval={0} tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={64} />
                <YAxis
                  stroke="#94a3b8"
                  width={58}
                  tickFormatter={(value) => compactMoney(Number(value))}
                />
                <Tooltip
                  formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                  }}
                />
                <Bar dataKey="capHit" name="Cap hit" fill="#34d399">
                  {selectedPlayers.map((p, index) => p.capHit !== null ? <Cell key={p.id} fill={COLORS[index]} /> : null)}
                  <LabelList
                    dataKey="capHit"
                    position="top"
                    formatter={(value) =>
                      compactMoney(Number(value ?? 0))
                    }
                    style={{ fill: "#cbd5f5", fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </main>
  );
}
