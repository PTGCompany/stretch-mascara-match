import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HamburgerLogo, MascaraIcon, SephoraToken } from "./icons";
import { Ticket, newTicket, type TicketData } from "./Ticket";
import {
  loadConfig,
  saveSession,
  type GameConfig,
  type SessionResult,
} from "@/lib/game-config";
import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";

type TileState = "hidden" | "revealed-target" | "revealed-empty";

type Phase = "idle" | "playing" | "win" | "loss";

function buildTiles(total: number, targets: number): boolean[] {
  const arr = Array.from({ length: total }, (_, i) => i < targets);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function GameBoard() {
  const [config, setConfig] = useState<GameConfig>(() => loadConfig());
  const [phase, setPhase] = useState<Phase>("idle");
  const [tiles, setTiles] = useState<boolean[]>([]);
  const [states, setStates] = useState<TileState[]>([]);
  const [targetsFound, setTargetsFound] = useState(0);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.durationSeconds);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const startedAt = useRef<number>(0);
  const lockRef = useRef(false);

  const total = config.gridCols * config.gridRows;

  const start = useCallback(() => {
    const cfg = loadConfig();
    setConfig(cfg);
    const t = cfg.gridCols * cfg.gridRows;
    setTiles(buildTiles(t, cfg.targetsRequired));
    setStates(Array.from({ length: t }, () => "hidden"));
    setTargetsFound(0);
    setAttemptsUsed(0);
    setTimeLeft(cfg.durationSeconds);
    setTicket(null);
    startedAt.current = Date.now();
    lockRef.current = false;
    setPhase("playing");
  }, []);

  const finish = useCallback(
    (result: SessionResult, found: number, used: number) => {
      lockRef.current = true;
      const t = result === "WIN" ? newTicket() : null;
      if (t) setTicket(t);
      setPhase(result === "WIN" ? "win" : "loss");
      saveSession({
        id: crypto.randomUUID(),
        result,
        targetsFound: found,
        attemptsUsed: used,
        durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        createdAt: Date.now(),
        ticketCode: t?.code,
      });
    },
    [],
  );

  // timer
  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) {
      finish("TIMEOUT", targetsFound, attemptsUsed);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timeLeft, finish, targetsFound, attemptsUsed]);

  const onTap = (i: number) => {
    if (phase !== "playing" || lockRef.current) return;
    if (states[i] !== "hidden") return;
    const isTarget = tiles[i];
    const next = [...states];
    next[i] = isTarget ? "revealed-target" : "revealed-empty";
    setStates(next);
    if (isTarget) {
      const found = targetsFound + 1;
      setTargetsFound(found);
      if (found >= config.targetsRequired) {
        finish("WIN", found, attemptsUsed);
      }
    } else {
      const used = attemptsUsed + 1;
      setAttemptsUsed(used);
      if (used >= config.attemptsAllowed) {
        finish("LOSS", targetsFound, used);
      }
    }
  };

  const progress = useMemo(
    () => (phase === "playing" ? (timeLeft / config.durationSeconds) * 100 : 0),
    [phase, timeLeft, config.durationSeconds],
  );

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
      <div
        className="relative w-full max-w-[560px] rounded-[2.5rem] bg-card px-6 pb-10 pt-7 text-card-foreground"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {/* header */}
        <div className="flex items-center justify-center pb-4">
          <HamburgerLogo />
        </div>

        {/* title */}
        <h1 className="text-center text-4xl font-black tracking-tight sm:text-5xl">
          {config.title}{" "}
          <span style={{ color: "var(--sephora-pink)" }}>
            {config.titleAccent}
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-[28ch] text-center text-[11px] font-bold uppercase leading-snug tracking-wider text-foreground/80 sm:text-xs">
          {config.instruction}
        </p>

        {/* grid */}
        <div
          className="mx-auto mt-6 grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${config.gridCols}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: total }).map((_, i) => {
            const s = states[i] ?? "hidden";
            const isRevealed = s !== "hidden";
            const isTarget = s === "revealed-target";
            return (
              <button
                key={i}
                onClick={() => onTap(i)}
                disabled={phase !== "playing" || isRevealed}
                aria-label={`Token ${i + 1}`}
                className="group relative aspect-square w-full rounded-full transition-transform active:scale-95 disabled:active:scale-100"
              >
                <div
                  className={[
                    "absolute inset-0 rounded-full transition-all duration-300",
                    isRevealed
                      ? "bg-white ring-2"
                      : "bg-token text-token-foreground",
                  ].join(" ")}
                  style={
                    isRevealed
                      ? {
                          boxShadow: isTarget
                            ? "0 0 0 3px var(--sephora-pink)"
                            : "0 0 0 2px var(--border)",
                        }
                      : undefined
                  }
                >
                  {!isRevealed && (
                    <div className="flex h-full w-full flex-col items-center justify-center leading-none">
                      <span className="text-[8px] font-black tracking-wider text-white sm:text-[9px]">
                        SEPHORA
                      </span>
                      <span className="text-[6px] font-bold tracking-widest text-white sm:text-[7px]">
                        COLLECTION
                      </span>
                    </div>
                  )}
                  {isRevealed && isTarget && (
                    <MascaraIcon className="absolute inset-0 m-auto h-[78%] w-[78%]" />
                  )}
                  {isRevealed && !isTarget && (
                    <div className="absolute inset-0 m-auto flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* timer + progress */}
        <div className="mt-8">
          <div
            className="text-center text-5xl font-black tabular-nums"
            style={{ color: "var(--sephora-pink)" }}
          >
            {phase === "idle" ? config.durationSeconds : timeLeft}"
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${phase === "playing" ? progress : phase === "idle" ? 100 : 0}%`,
                backgroundColor: "var(--sephora-pink)",
              }}
            />
          </div>
        </div>

        {/* admin link */}
        <Link
          to="/admin"
          className="absolute right-4 top-4 text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label="Admin"
        >
          <Settings className="h-4 w-4" />
        </Link>

        {/* ticket overlay on win */}
        {phase === "win" && ticket && (
          <Ticket
            data={ticket}
            config={config}
            onClose={() => setTicket(null)}
            onReplay={start}
          />
        )}

        {/* overlay */}
        {phase !== "playing" && !(phase === "win" && ticket) && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[2.5rem] bg-card/95 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6 px-8 text-center">
              {phase === "idle" && (
                <>
                  <h2 className="text-3xl font-black">
                    PRÊT(E) À <span style={{ color: "var(--sephora-pink)" }}>JOUER</span> ?
                  </h2>
                  <p className="max-w-[28ch] text-xs font-bold uppercase tracking-wider text-foreground/70">
                    {config.instruction}
                  </p>
                </>
              )}
              {phase === "loss" && (
                <h2 className="text-3xl font-black leading-tight">
                  DOMMAGE,
                  <br />
                  <span style={{ color: "var(--sephora-pink)" }}>
                    RETENTEZ VOTRE CHANCE !
                  </span>
                </h2>
              )}
              <button
                onClick={start}
                className="rounded-full px-10 py-4 text-base font-black uppercase tracking-widest text-white transition-transform active:scale-95"
                style={{ backgroundColor: "var(--sephora-pink)" }}
              >
                {phase === "idle" ? "Commencer" : "Rejouer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
