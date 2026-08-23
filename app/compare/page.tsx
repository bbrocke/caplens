"use client";

import { useEffect, useState } from "react";
import { fetchPlayers, isOnActiveRoster, type Player } from "@/lib/players";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

export default function ComparePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPlayers().then(({ players, error }) => {
      if (cancelled) return;
      setPlayers(players.filter(isOnActiveRoster));
      setError(error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const togglePlayer = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const selectedPlayers = players.filter((p) => selected.includes(p.id));

  const filteredPlayers = players.filter((player) =>
    `${player.name} ${player.team} ${player.position}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="text-4xl font-bold">Compare Players</h1>

      {error && (
        <p className="mt-4 text-red-500">Error: {error}</p>
      )}

      {loading && (
        <p className="mt-4 text-slate-400">Loading players…</p>
      )}

      <input
        type="text"
        placeholder="Search by player, team, or position..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-6 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
      />

      {/* Player selector */}
      <div className="mt-6 flex flex-wrap gap-2">
        {filteredPlayers.map((player) => (
          <button
            key={player.id}
            onClick={() => togglePlayer(player.id)}
            className={`rounded-full px-4 py-2 text-sm ${
              selected.includes(player.id)
                ? "bg-emerald-500 text-black"
                : "bg-slate-800"
            }`}
          >
            {player.name}
          </button>
        ))}
      </div>

      {/* Comparison grid */}
      {selectedPlayers.length > 0 && (
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {selectedPlayers.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h2 className="text-xl font-bold">{p.name}</h2>
              <p className="text-slate-400">{p.team}</p>

              <div className="mt-4 space-y-2">
                <p>Cap Hit: ${p.capHit.toLocaleString()}</p>
                <p>AAV: ${p.aav.toLocaleString()}</p>
                <p>Cap %: {p.capPercent}%</p>
                <p>Years: {p.years}</p>
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
        <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-6 text-xl font-bold">Cap Hit Comparison</h2>

          <div className="h-72 w-full">
            <ResponsiveContainer>
              <BarChart data={selectedPlayers}>
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis
                  stroke="#94a3b8"
                  tickFormatter={(value) => `$${value / 1000000}M`}
                />
                <Tooltip
                  formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                  }}
                />
                <Bar dataKey="capHit" fill="#34d399">
                  <LabelList
                    dataKey="capHit"
                    position="top"
                    formatter={(value) =>
                      `$${(Number(value ?? 0) / 1000000).toFixed(1)}M`
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
