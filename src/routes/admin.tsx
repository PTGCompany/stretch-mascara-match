import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MotionButton } from "@/components/MotionButton";
import {
  DEFAULT_CONFIG,
  clearSessions,
  loadConfig,
  loadSessions,
  saveConfig,
  validateWinLevels,
  type GameConfig,
  type GameSession,
  type WinLevel,
} from "@/lib/game-config";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Sephora Memory Game" }] }),
  component: AdminPage,
});

function AdminPage() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
    setSessions(loadSessions());
  }, []);

  const stats = useMemo(() => {
    const total = sessions.length;
    if (!total)
      return {
        total: 0,
        avgPairs: "0",
        best: 0,
        avgWrong: "0",
        perfects: 0,
        timeouts: 0,
        byLevel: [0, 0, 0, 0, 0, 0],
      };
    const avgPairs = (
      sessions.reduce((a, s) => a + s.pairsFound, 0) / total
    ).toFixed(1);
    const best = sessions.reduce((m, s) => Math.max(m, s.pairsFound), 0);
    const avgWrong = (
      sessions.reduce((a, s) => a + s.wrongAttempts, 0) / total
    ).toFixed(1);
    const perfects = sessions.filter(
      (s) => s.completedReason === "PERFECT_SCORE",
    ).length;
    const timeouts = sessions.filter(
      (s) => s.completedReason === "TIMEOUT",
    ).length;
    const byLevel = [0, 0, 0, 0, 0, 0];
    for (const s of sessions) {
      if (s.finalWinLevel && s.finalWinLevel >= 1 && s.finalWinLevel <= 6) {
        byLevel[s.finalWinLevel - 1]++;
      }
    }
    return { total, avgPairs, best, avgWrong, perfects, timeouts, byLevel };
  }, [sessions]);

  const update = <K extends keyof GameConfig>(k: K, v: GameConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  const updateLevel = (idx: number, patch: Partial<WinLevel>) =>
    setConfig((c) => {
      const next = c.winLevels.map((lv, i) =>
        i === idx ? { ...lv, ...patch } : lv,
      );
      return { ...c, winLevels: next };
    });

  const save = () => {
    const err = validateWinLevels(config.winLevels);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const exportCsv = () => {
    const header =
      "id,completedReason,pairsFound,totalPairs,wrongAttempts,finalWinLevel,durationSeconds,createdAt\n";
    const rows = sessions
      .map(
        (s) =>
          `${s.id},${s.completedReason},${s.pairsFound},${s.totalPairs},${s.wrongAttempts},${s.finalWinLevel ?? ""},${s.durationSeconds},${new Date(s.createdAt).toISOString()}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sephora-memory-sessions-${Date.now()}.csv`;
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
          <h1 className="text-2xl font-black tracking-tight">
            Admin · Memory Game
          </h1>
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
            <Field label="Hero product">
              <input
                className="input"
                value={config.heroProductName}
                onChange={(e) => update("heroProductName", e.target.value)}
              />
            </Field>
            <Field label="Instruction" full>
              <input
                className="input"
                value={config.instruction}
                onChange={(e) => update("instruction", e.target.value)}
              />
            </Field>
            <Field label="Duration (s)">
              <input
                type="number"
                min={5}
                className="input"
                value={config.durationSeconds}
                onChange={(e) =>
                  update("durationSeconds", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Total pairs">
              <input
                type="number"
                min={2}
                max={32}
                className="input"
                value={config.totalPairs}
                onChange={(e) => update("totalPairs", Number(e.target.value))}
              />
            </Field>
            <Field label="Grid rows">
              <input
                type="number"
                min={2}
                max={8}
                className="input"
                value={config.gridRows}
                onChange={(e) => update("gridRows", Number(e.target.value))}
              />
            </Field>
            <Field label="Grid columns">
              <input
                type="number"
                min={2}
                max={8}
                className="input"
                value={config.gridCols}
                onChange={(e) => update("gridCols", Number(e.target.value))}
              />
            </Field>
            <Field label="Flip-back delay (ms)">
              <input
                type="number"
                min={300}
                max={2000}
                className="input"
                value={config.flipBackDelayMs}
                onChange={(e) =>
                  update("flipBackDelayMs", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Brand color">
              <input
                type="color"
                className="input"
                value={config.brandColor}
                onChange={(e) => update("brandColor", e.target.value)}
              />
            </Field>
            <Field label="Track wrong attempts">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.trackWrongAttempts}
                  onChange={(e) =>
                    update("trackWrongAttempts", e.target.checked)
                  }
                />
                <span className="text-xs">Analytics only — never blocks the player</span>
              </label>
            </Field>
          </div>

          <h3 className="mt-6 text-sm font-black uppercase tracking-wider">
            Win levels (1 → 6)
          </h3>
          <div className="mt-3 space-y-2">
            {config.winLevels.map((lv, idx) => (
              <div
                key={lv.level}
                className="grid grid-cols-[60px_repeat(2,1fr)_2fr] items-center gap-2"
              >
                <span className="text-xs font-bold uppercase">Lv {lv.level}</span>
                <input
                  type="number"
                  min={1}
                  max={32}
                  className="input"
                  value={lv.min}
                  onChange={(e) =>
                    updateLevel(idx, { min: Number(e.target.value) })
                  }
                />
                <input
                  type="number"
                  min={1}
                  max={32}
                  className="input"
                  value={lv.max}
                  onChange={(e) =>
                    updateLevel(idx, { max: Number(e.target.value) })
                  }
                />
                <input
                  className="input"
                  value={lv.message}
                  onChange={(e) =>
                    updateLevel(idx, { message: e.target.value })
                  }
                />
              </div>
            ))}
          </div>
          {error && (
            <p className="mt-3 text-xs font-bold text-destructive">{error}</p>
          )}
          <div className="mt-6 flex items-center gap-3">
            <MotionButton intent="primary" size="sm" onClick={save}>
              Save
            </MotionButton>
            {saved && (
              <span className="text-xs text-muted-foreground">Saved ✓</span>
            )}
          </div>
        </section>

        {/* analytics */}
        <section className="rounded-2xl bg-card p-6 text-card-foreground">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">Sessions</h2>
            <div className="flex gap-2">
              <MotionButton intent="ghost" size="sm" onClick={exportCsv}>
                Export CSV
              </MotionButton>
              <MotionButton intent="danger" size="sm" onClick={reset}>
                Reset
              </MotionButton>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Sessions" value={stats.total} />
            <Stat label="Best score" value={stats.best} />
            <Stat label="Avg pairs" value={stats.avgPairs} />
            <Stat label="Avg errors" value={stats.avgWrong} />
            <Stat label="Perfects" value={stats.perfects} />
            <Stat label="Timeouts" value={stats.timeouts} />
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2">
            {stats.byLevel.map((n, i) => (
              <div
                key={i}
                className="rounded-xl border bg-muted/30 p-2 text-center"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Lv {i + 1}
                </div>
                <div
                  className="text-lg font-black"
                  style={{ color: "var(--sephora-pink)" }}
                >
                  {n}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 max-h-80 overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="p-2 text-left">When</th>
                  <th className="p-2 text-left">Reason</th>
                  <th className="p-2 text-left">Pairs</th>
                  <th className="p-2 text-left">Level</th>
                  <th className="p-2 text-left">Errors</th>
                  <th className="p-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 100).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="p-2 font-bold">{s.completedReason}</td>
                    <td className="p-2">
                      {s.pairsFound}/{s.totalPairs}
                    </td>
                    <td className="p-2">{s.finalWinLevel ?? "—"}</td>
                    <td className="p-2">{s.wrongAttempts}</td>
                    <td className="p-2">{s.durationSeconds}s</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-4 text-center text-muted-foreground"
                    >
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

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="text-2xl font-black"
        style={{ color: "var(--sephora-pink)" }}
      >
        {value}
      </div>
    </div>
  );
}
