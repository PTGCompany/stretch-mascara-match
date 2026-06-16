import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CONFIG,
  clearSessions,
  loadConfig,
  loadSessions,
  saveConfig,
  type GameConfig,
  type GameSession,
} from "@/lib/game-config";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Sephora Game" }] }),
  component: AdminPage,
});

function AdminPage() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
    setSessions(loadSessions());
  }, []);

  const stats = useMemo(() => {
    const total = sessions.length;
    const wins = sessions.filter((s) => s.result === "WIN").length;
    const avgAttempts =
      total > 0
        ? (sessions.reduce((a, s) => a + s.attemptsUsed, 0) / total).toFixed(1)
        : "0";
    const avgDuration =
      total > 0
        ? (sessions.reduce((a, s) => a + s.durationSeconds, 0) / total).toFixed(1)
        : "0";
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { total, wins, avgAttempts, avgDuration, winRate };
  }, [sessions]);

  const update = <K extends keyof GameConfig>(k: K, v: GameConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  const save = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const exportCsv = () => {
    const header = "id,result,targetsFound,attemptsUsed,durationSeconds,createdAt\n";
    const rows = sessions
      .map(
        (s) =>
          `${s.id},${s.result},${s.targetsFound},${s.attemptsUsed},${s.durationSeconds},${new Date(s.createdAt).toISOString()}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sephora-sessions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    clearSessions();
    setSessions([]);
  };

  return (
    <div className="min-h-dvh bg-background p-6 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight">Admin · Memory Game</h1>
          <Link
            to="/"
            className="rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wider"
            style={{ backgroundColor: "var(--sephora-pink)" }}
          >
            ← Game
          </Link>
        </div>

        {/* settings */}
        <section className="rounded-2xl bg-card p-6 text-card-foreground">
          <h2 className="mb-4 text-lg font-black">Game Settings</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input
                className="input"
                value={config.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </Field>
            <Field label="Title accent">
              <input
                className="input"
                value={config.titleAccent}
                onChange={(e) => update("titleAccent", e.target.value)}
              />
            </Field>
            <Field label="Target product">
              <input
                className="input"
                value={config.targetProductName}
                onChange={(e) => update("targetProductName", e.target.value)}
              />
            </Field>
            <Field label="Instruction" full>
              <input
                className="input"
                value={config.instruction}
                onChange={(e) => update("instruction", e.target.value)}
              />
            </Field>
            <Field label="Targets required">
              <input
                type="number"
                min={1}
                className="input"
                value={config.targetsRequired}
                onChange={(e) => update("targetsRequired", Number(e.target.value))}
              />
            </Field>
            <Field label="Attempts allowed">
              <input
                type="number"
                min={1}
                className="input"
                value={config.attemptsAllowed}
                onChange={(e) => update("attemptsAllowed", Number(e.target.value))}
              />
            </Field>
            <Field label="Duration (s)">
              <input
                type="number"
                min={3}
                className="input"
                value={config.durationSeconds}
                onChange={(e) => update("durationSeconds", Number(e.target.value))}
              />
            </Field>
            <Field label="Grid cols">
              <input
                type="number"
                min={2}
                max={8}
                className="input"
                value={config.gridCols}
                onChange={(e) => update("gridCols", Number(e.target.value))}
              />
            </Field>
            <Field label="Grid rows">
              <input
                type="number"
                min={2}
                max={10}
                className="input"
                value={config.gridRows}
                onChange={(e) => update("gridRows", Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={save}
              className="rounded-full px-6 py-2 text-sm font-bold uppercase text-white"
              style={{ backgroundColor: "var(--sephora-pink)" }}
            >
              Save
            </button>
            {saved && <span className="text-xs text-muted-foreground">Saved ✓</span>}
          </div>
        </section>

        {/* analytics */}
        <section className="rounded-2xl bg-card p-6 text-card-foreground">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">Sessions</h2>
            <div className="flex gap-2">
              <button onClick={exportCsv} className="btn-ghost">Export CSV</button>
              <button onClick={reset} className="btn-ghost text-destructive">Reset</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Sessions" value={stats.total} />
            <Stat label="Win rate" value={`${stats.winRate}%`} />
            <Stat label="Avg attempts" value={stats.avgAttempts} />
            <Stat label="Avg time" value={`${stats.avgDuration}s`} />
          </div>
          <div className="mt-6 max-h-80 overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="p-2 text-left">When</th>
                  <th className="p-2 text-left">Result</th>
                  <th className="p-2 text-left">Ticket</th>
                  <th className="p-2 text-left">Found</th>
                  <th className="p-2 text-left">Attempts</th>
                  <th className="p-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 100).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{new Date(s.createdAt).toLocaleString()}</td>
                    <td className="p-2 font-bold">{s.result}</td>
                    <td className="p-2 font-mono">{s.ticketCode ?? "—"}</td>
                    <td className="p-2">{s.targetsFound}</td>
                    <td className="p-2">{s.attemptsUsed}</td>
                    <td className="p-2">{s.durationSeconds}s</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No sessions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style>{`
        .input { width: 100%; border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.5rem 0.75rem; background: white; color: var(--foreground); }
        .btn-ghost { border: 1px solid var(--border); border-radius: 9999px; padding: 0.4rem 0.9rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-black" style={{ color: "var(--sephora-pink)" }}>
        {value}
      </div>
    </div>
  );
}
