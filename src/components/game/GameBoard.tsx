import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionButton } from "@/components/MotionButton";
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
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-background px-4 py-6">
      {/* ambient coral glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(237,111,126,0.55) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      {/* SEPHORA COLLECTION brand banner */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mb-5 flex w-full max-w-[560px] items-center justify-between overflow-hidden rounded-2xl px-6 py-4"
        style={{
          background:
            "linear-gradient(90deg, #ed6f7e 0%, #f08a98 55%, #ec7686 100%)",
          boxShadow: "0 20px 40px -20px rgba(237,111,126,0.55)",
        }}
      >
        <span
          className="wordmark text-white"
          style={{ fontSize: 15, letterSpacing: "0.42em" }}
        >
          SEPHORA COLLECTION
        </span>
        <span
          className="wordmark hidden text-white/80 sm:inline"
          style={{ fontSize: 10, letterSpacing: "0.3em" }}
        >
          MEMORY GAME
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[560px] rounded-[2.25rem] bg-card px-6 pb-10 pt-7 text-card-foreground"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {/* header — Sephora wordmark, centered, with hairline rule */}
        <div className="flex flex-col items-center pb-5">
          <HamburgerLogo />
          <div
            className="mt-2 wordmark"
            style={{
              fontSize: 9,
              letterSpacing: "0.42em",
              color: "var(--sephora-coral-deep)",
            }}
          >
            COLLECTION
          </div>
          <div className="mt-4 h-px w-full bg-black/8" />
        </div>

        {/* title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.16, ease: "easeOut" }}
          className="font-display text-center text-[40px] leading-[0.95] sm:text-[52px]"
        >
          {config.title}
          <br />
          <span style={{ color: "var(--sephora-pink)" }}>
            {config.titleAccent}
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.16 }}
          className="mx-auto mt-4 max-w-[30ch] text-center text-[11px] font-semibold uppercase leading-snug tracking-[0.18em] text-black/70"
        >
          {config.instruction}
        </motion.p>

        {/* grid */}
        <div
          className="mx-auto mt-7 grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${config.gridCols}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: total }).map((_, i) => {
            const s = states[i] ?? "hidden";
            const isRevealed = s !== "hidden";
            const isTarget = s === "revealed-target";
            const isWrong = s === "revealed-empty";
            return (
              <MotionButton
                key={i}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={
                  isWrong
                    ? { opacity: 1, scale: 1, x: [0, -4, 4, -3, 3, 0] }
                    : { opacity: 1, scale: 1, x: 0 }
                }
                transition={
                  isWrong
                    ? { x: { duration: 0.28, ease: "easeInOut" } }
                    : {
                        delay: Math.min(0.12, 0.04 + i * 0.005),
                        type: "spring",
                        stiffness: 520,
                        damping: 26,
                        mass: 0.6,
                      }
                }
                whileTap={
                  phase === "playing" && !isRevealed
                    ? { scale: 0.9 }
                    : { scale: 1 }
                }
                whileHover={
                  phase === "playing" && !isRevealed
                    ? { scale: 1.04 }
                    : { scale: 1 }
                }
                onClick={() => onTap(i)}
                disabled={phase !== "playing" || isRevealed}
                aria-label={`Token ${i + 1}`}
                intent="token"
                style={{ perspective: 800, touchAction: "manipulation" }}
              >
                <motion.div
                  animate={{ rotateY: isRevealed ? 180 : 0 }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                  style={{
                    transformStyle: "preserve-3d",
                    willChange: "transform",
                  }}
                >
                  {/* back (token face) */}
                  <div
                    className="absolute inset-0 rounded-full bg-token"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      boxShadow:
                        "inset 0 0 0 1px rgba(255,255,255,0.06), 0 6px 14px -6px rgba(0,0,0,0.45)",
                    }}
                  >
                    <SephoraToken />
                  </div>
                  {/* front (revealed) */}
                  <motion.div
                    animate={
                      isTarget
                        ? { scale: [1, 1.08, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.32, ease: "easeOut", delay: 0.18 }}
                    className="absolute inset-0 rounded-full bg-white"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      boxShadow: isTarget
                        ? "0 0 0 2px var(--sephora-pink), 0 8px 24px -8px rgba(229,9,127,0.6)"
                        : "0 0 0 1px var(--border)",
                    }}
                  >
                    {isTarget ? (
                      <MascaraIcon className="absolute inset-0 m-auto h-[80%] w-[80%]" />
                    ) : (
                      <div className="absolute inset-0 m-auto flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-black/15" />
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              </motion.button>
            );
          })}
        </div>

        {/* timer + progress */}
        <div className="mt-8">
          <div className="flex items-baseline justify-center gap-1">
            <motion.div
              key={timeLeft + phase}
              initial={{ scale: 1.18, opacity: 0.5 }}
              animate={
                phase === "playing" && timeLeft <= 5
                  ? { scale: [1, 1.1, 1], opacity: 1 }
                  : { scale: 1, opacity: 1 }
              }
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-[56px] leading-none tabular-nums"
              style={{
                color:
                  phase === "playing" && timeLeft <= 5
                    ? "#ff1f8a"
                    : "var(--sephora-pink)",
              }}
            >
              {phase === "idle" ? config.durationSeconds : timeLeft}
            </motion.div>
            <span
              className="font-display text-2xl"
              style={{ color: "var(--sephora-pink)" }}
            >
              s
            </span>
          </div>
          <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-black/5">
            <motion.div
              className="h-full rounded-full"
              animate={{
                width: `${phase === "playing" ? progress : phase === "idle" ? 100 : 0}%`,
              }}
              transition={{ duration: 0.9, ease: "linear" }}
              style={{ backgroundColor: "var(--sephora-pink)" }}
            />
          </div>
          {phase === "playing" && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="mt-4 flex items-center justify-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/60"
            >
              <span>
                Trouvés{" "}
                <span style={{ color: "var(--sephora-pink)" }}>
                  {targetsFound}/{config.targetsRequired}
                </span>
              </span>
              <span className="h-1 w-1 rounded-full bg-black/20" />
              <span>
                Essais{" "}
                <span style={{ color: "var(--sephora-pink)" }}>
                  {attemptsUsed}/{config.attemptsAllowed}
                </span>
              </span>
            </motion.div>
          )}
        </div>




        {/* admin link */}
        <motion.div
          className="absolute right-4 top-4"
          whileHover={{ scale: 1.15, rotate: 35 }}
          whileTap={{ scale: 0.9, rotate: -10 }}
          transition={{ type: "spring", stiffness: 420, damping: 18 }}
        >
          <Link
            to="/admin"
            className="block text-muted-foreground/60 transition-colors hover:text-foreground"
            aria-label="Admin"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </motion.div>

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
        <AnimatePresence>
          {phase !== "playing" && !(phase === "win" && ticket) && (
            <motion.div
              key={phase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="absolute inset-0 flex items-center justify-center rounded-[2.25rem] bg-card/95 backdrop-blur-sm"
            >
              <motion.div
                initial={{ y: 8, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center gap-7 px-8 text-center"
              >
                {phase === "idle" && (
                  <>
                    <h2 className="font-display text-[34px] leading-none">
                      PRÊT(E) À{" "}
                      <span style={{ color: "var(--sephora-pink)" }}>JOUER</span> ?
                    </h2>
                    <p className="max-w-[28ch] text-[11px] font-semibold uppercase tracking-[0.2em] text-black/65">
                      {config.instruction}
                    </p>
                  </>
                )}
                {phase === "loss" && (
                  <h2 className="font-display text-[32px] leading-tight">
                    DOMMAGE,
                    <br />
                    <span style={{ color: "var(--sephora-pink)" }}>
                      RETENTEZ VOTRE CHANCE !
                    </span>
                  </h2>
                )}
                <motion.button
                  initial={{ scale: 0.92, opacity: 0, y: 8 }}
                  animate={
                    phase === "idle"
                      ? {
                          scale: [1, 1.045, 1],
                          opacity: 1,
                          y: 0,
                          boxShadow: [
                            "0 12px 30px -10px rgba(237,111,126,0.55)",
                            "0 22px 50px -10px rgba(237,111,126,0.9)",
                            "0 12px 30px -10px rgba(237,111,126,0.55)",
                          ],
                        }
                      : { scale: 1, opacity: 1, y: 0 }
                  }
                  transition={
                    phase === "idle"
                      ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                      : { type: "spring", stiffness: 380, damping: 24, mass: 0.7 }
                  }
                  whileHover={{
                    scale: 1.06,
                    y: -2,
                    transition: { type: "spring", stiffness: 420, damping: 18 },
                  }}
                  whileTap={{
                    scale: 0.94,
                    transition: { type: "spring", stiffness: 600, damping: 26 },
                  }}
                  onClick={start}
                  className="wordmark rounded-full px-12 py-4 text-[13px] text-white"
                  style={{ backgroundColor: "var(--sephora-pink)" }}
                >
                  {phase === "idle" ? "Commencer" : "Rejouer"}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
