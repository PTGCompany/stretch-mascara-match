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

type SetResult = "pending" | "win" | "loss" | "timeout";
type PlayPhase = "idle" | "setPlaying" | "setResult" | "playResult";

const SETS_PER_PLAY = 3;

function buildTiles(total: number, targets: number): boolean[] {
  const arr = Array.from({ length: total }, (_, i) => i < targets);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function GameBoard() {
  const [config] = useState<GameConfig>(() => loadConfig());
  const [phase, setPhase] = useState<PlayPhase>("idle");
  const [tiles, setTiles] = useState<boolean[]>([]);
  const [states, setStates] = useState<TileState[]>([]);
  const [currentSet, setCurrentSet] = useState(1);
  const [setTriesUsed, setSetTriesUsed] = useState(0);
  const [setFound, setSetFound] = useState(0);
  const [setResults, setSetResults] = useState<SetResult[]>([
    "pending",
    "pending",
    "pending",
  ]);
  const setResultsRef = useRef<SetResult[]>(["pending", "pending", "pending"]);
  const [timeLeft, setTimeLeft] = useState(config.durationSeconds);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const startedAt = useRef<number>(0);
  const lockRef = useRef(false);
  const total = config.gridCols * config.gridRows;

  const startPlay = () => {
    const cfg = loadConfig();
    const t = cfg.gridCols * cfg.gridRows;
    setTiles(buildTiles(t, cfg.targetsHidden));
    setStates(Array.from({ length: t }, () => "hidden"));
    setCurrentSet(1);
    setSetTriesUsed(0);
    setSetFound(0);
    const freshResults: SetResult[] = ["pending", "pending", "pending"];
    setSetResults(freshResults);
    setResultsRef.current = freshResults;
    setTimeLeft(cfg.durationSeconds);
    setTicket(null);
    startedAt.current = Date.now();
    lockRef.current = false;
    setPhase("setPlaying");
  };

  const startSet = useCallback(
    (setNum: number) => {
      setCurrentSet(setNum);
      setSetTriesUsed(0);
      setSetFound(0);
      setStates((prev) => prev.map(() => "hidden"));
      setTimeLeft(config.durationSeconds);
      lockRef.current = false;
      setPhase("setPlaying");
    },
    [config.durationSeconds]
  );

  const finishSet = useCallback(
    (result: SetResult, found: number, used: number) => {
      if (lockRef.current) return;
      lockRef.current = true;

      const nextResults = [...setResultsRef.current];
      nextResults[currentSet - 1] = result;
      setResultsRef.current = nextResults;
      setSetResults(nextResults);

      setPhase("setResult");

      window.setTimeout(() => {
        const resultsNow = setResultsRef.current;
        if (currentSet < SETS_PER_PLAY) {
          startSet(currentSet + 1);
        } else {
          const playWon = resultsNow.some((r) => r === "win");
          const totalFound = resultsNow.filter((r) => r === "win").length * config.targetsRequired;
          const totalUsed = resultsNow.reduce((acc, r, i) => {
            if (r === "win") return acc + config.targetsRequired;
            if (r === "loss" || r === "timeout") return acc + config.attemptsAllowed;
            return acc;
          }, 0);

          if (playWon) {
            const t = newTicket();
            setTicket(t);
            saveSession({
              id: crypto.randomUUID(),
              result: "WIN" as SessionResult,
              targetsFound: totalFound,
              attemptsUsed: totalUsed,
              durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
              createdAt: Date.now(),
              ticketCode: t.code,
            });
          } else {
            saveSession({
              id: crypto.randomUUID(),
              result: "LOSS" as SessionResult,
              targetsFound: totalFound,
              attemptsUsed: totalUsed,
              durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
              createdAt: Date.now(),
            });
          }
          setPhase("playResult");
        }
      }, 1600);
    },
    [currentSet, config.targetsRequired, config.attemptsAllowed, startSet]
  );

  const onTap = useCallback(
    (i: number) => {
      if (phase !== "setPlaying" || lockRef.current) return;
      if (states[i] !== "hidden") return;

      const isTarget = tiles[i];
      const nextStates = [...states];
      nextStates[i] = isTarget ? "revealed-target" : "revealed-empty";
      setStates(nextStates);

      const newFound = isTarget ? setFound + 1 : setFound;
      const newTries = setTriesUsed + 1;
      if (isTarget) setSetFound(newFound);
      setSetTriesUsed(newTries);

      if (newFound >= config.targetsRequired) {
        finishSet("win", newFound, newTries);
      } else if (newTries >= config.attemptsAllowed) {
        window.setTimeout(() => finishSet("loss", newFound, newTries), 700);
      } else if (!isTarget) {
        window.setTimeout(() => {
          setStates((prev) => {
            if (prev[i] !== "revealed-empty") return prev;
            const copy = [...prev];
            copy[i] = "hidden";
            return copy;
          });
        }, 900);
      }
    },
    [
      phase,
      states,
      tiles,
      setFound,
      setTriesUsed,
      config.targetsRequired,
      config.attemptsAllowed,
      finishSet,
    ]
  );

  useEffect(() => {
    if (phase !== "setPlaying") return;
    if (timeLeft <= 0) {
      finishSet("timeout", setFound, setTriesUsed);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timeLeft, finishSet, setFound, setTriesUsed]);

  const progress = useMemo(
    () =>
      phase === "setPlaying"
        ? (timeLeft / config.durationSeconds) * 100
        : 0,
    [phase, timeLeft, config.durationSeconds]
  );

  const wonSets = useMemo(
    () => setResults.filter((r) => r === "win").length,
    [setResults]
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
        {/* header */}
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
                initial={{ opacity: 0, scale: 0.5, y: 6 }}
                animate={
                  isWrong
                    ? { opacity: 1, scale: 1, y: 0, x: [0, -5, 5, -3, 3, 0] }
                    : { opacity: 1, scale: 1, y: 0, x: 0 }
                }
                transition={
                  isWrong
                    ? { x: { duration: 0.36, ease: [0.36, 0.07, 0.19, 0.97] } }
                    : {
                        delay: Math.min(0.22, 0.05 + i * 0.025),
                        type: "spring",
                        stiffness: 380,
                        damping: 22,
                        mass: 0.7,
                      }
                }
                whileTap={
                  phase === "setPlaying" && !isRevealed
                    ? { scale: 0.9 }
                    : { scale: 1 }
                }
                whileHover={
                  phase === "setPlaying" && !isRevealed
                    ? { scale: 1.04, y: -2 }
                    : { scale: 1 }
                }
                onClick={() => onTap(i)}
                disabled={phase !== "setPlaying" || isRevealed}
                aria-label={`Token ${i + 1}`}
                intent="token"
                style={{ perspective: 1000, touchAction: "manipulation" }}
              >
                <motion.div
                  animate={{
                    rotateY: isRevealed ? 180 : 0,
                    scale: isRevealed ? [1, 0.92, 1] : 1,
                  }}
                  transition={{
                    rotateY: { duration: 0.55, ease: [0.65, 0, 0.35, 1] },
                    scale: { duration: 0.55, ease: [0.22, 1, 0.36, 1], times: [0, 0.5, 1] },
                  }}
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
                        ? { scale: [1, 1.12, 1] }
                        : { scale: 1 }
                    }
                    transition={{
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.28,
                    }}
                    className="absolute inset-0 rounded-full bg-white"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      boxShadow: isTarget
                        ? "0 0 0 2px var(--sephora-pink), 0 10px 28px -8px rgba(229,9,127,0.65)"
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
              </MotionButton>
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
                phase === "setPlaying" && timeLeft <= 5
                  ? { scale: [1, 1.1, 1], opacity: 1 }
                  : { scale: 1, opacity: 1 }
              }
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-[56px] leading-none tabular-nums"
              style={{
                color:
                  phase === "setPlaying" && timeLeft <= 5
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
                width: `${phase === "setPlaying" ? progress : phase === "idle" ? 100 : 0}%`,
              }}
              transition={{ duration: 0.9, ease: "linear" }}
              style={{ backgroundColor: "var(--sephora-pink)" }}
            />
          </div>

          {/* perfect count at the bottom */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-5 flex flex-col items-center gap-3"
          >
            {/* main counters */}
            <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/60">
              <span>
                Manche{" "}
                <span style={{ color: "var(--sephora-pink)" }}>
                  {currentSet}/{SETS_PER_PLAY}
                </span>
              </span>
              <span className="h-1 w-1 rounded-full bg-black/20" />
              <span>
                Essai{" "}
                <span style={{ color: "var(--sephora-pink)" }}>
                  {setTriesUsed}/{config.attemptsAllowed}
                </span>
              </span>
              <span className="h-1 w-1 rounded-full bg-black/20" />
              <span>
                Trouvés{" "}
                <span style={{ color: "var(--sephora-pink)" }}>
                  {setFound}/{config.targetsRequired}
                </span>
              </span>
            </div>

            {/* set result indicators */}
            <div className="flex items-center gap-2">
              {setResults.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: i * 0.08 }}
                  className={`flex h-6 min-w-[4.5rem] items-center justify-center rounded-full px-2 text-[9px] font-black uppercase tracking-wider ${
                    r === "win"
                      ? "bg-emerald-50 text-emerald-600"
                      : r === "loss" || r === "timeout"
                      ? "bg-rose-50 text-rose-500"
                      : "bg-black/5 text-black/30"
                  }`}
                >
                  {r === "win"
                    ? "Gagné"
                    : r === "loss" || r === "timeout"
                    ? "Perdu"
                    : `Set ${i + 1}`}
                </motion.div>
              ))}
            </div>
          </motion.div>
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
        {phase === "playResult" && ticket && (
          <Ticket
            data={ticket}
            config={config}
            onClose={() => setTicket(null)}
            onReplay={startPlay}
          />
        )}

        {/* overlay */}
        <AnimatePresence mode="wait">
          {(phase === "idle" || phase === "setResult" || phase === "playResult") &&
            !(phase === "playResult" && ticket) && (
              <motion.div
                key={phase + currentSet}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex items-center justify-center rounded-[2.25rem] bg-card/95 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ y: 18, opacity: 0, scale: 0.94 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -10, opacity: 0, scale: 0.97 }}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 26,
                    mass: 0.8,
                    delay: 0.05,
                  }}
                  className="flex flex-col items-center gap-7 px-8 text-center"
                >
                  {phase === "idle" && (
                    <>
                      <h2 className="font-display text-[34px] leading-none">
                        PRÊT(E) À{" "}
                        <span style={{ color: "var(--sephora-pink)" }}>
                          JOUER
                        </span>{" "}
                        ?
                      </h2>
                      <p className="max-w-[32ch] text-[11px] font-semibold uppercase tracking-[0.2em] text-black/65">
                        3 manches — 2 essais par manche — retrouvez 2 mascaras IT&apos;S A STRETCH
                      </p>
                    </>
                  )}

                  {phase === "setResult" && (
                    <>
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="font-display text-[40px] leading-none"
                      >
                        {setResults[currentSet - 1] === "win" ? (
                          <span style={{ color: "var(--sephora-pink)" }}>
                            MANCHE {currentSet} GAGNÉE
                          </span>
                        ) : (
                          <span className="text-black/80">
                            MANCHE {currentSet} PERDUE
                          </span>
                        )}
                      </motion.div>
                      <div className="flex gap-2">
                        {setResults.map((r, i) => (
                          <div
                            key={i}
                            className={`h-3 w-3 rounded-full ${
                              r === "win"
                                ? "bg-emerald-400"
                                : r === "loss" || r === "timeout"
                                ? "bg-rose-400"
                                : "bg-black/10"
                            }`}
                          />
                        ))}
                      </div>
                      {currentSet < SETS_PER_PLAY && (
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">
                          Manche {currentSet + 1} dans un instant...
                        </p>
                      )}
                    </>
                  )}

                  {phase === "playResult" && (
                    <>
                      <motion.h2
                        initial={{ x: 0 }}
                        animate={
                          wonSets === 0
                            ? { x: [0, -8, 8, -5, 5, 0] }
                            : { x: 0 }
                        }
                        transition={{
                          duration: 0.5,
                          ease: [0.36, 0.07, 0.19, 0.97],
                          delay: 0.1,
                        }}
                        className="font-display text-[32px] leading-tight"
                      >
                        {wonSets > 0 ? (
                          <>
                            BRAVO,
                            <br />
                            <span style={{ color: "var(--sephora-pink)" }}>
                              {wonSets}/3 MANCHES GAGNÉES
                            </span>
                          </>
                        ) : (
                          <>
                            DOMMAGE,
                            <br />
                            <span style={{ color: "var(--sephora-pink)" }}>
                              RETENTEZ VOTRE CHANCE !
                            </span>
                          </>
                        )}
                      </motion.h2>

                      <div className="flex gap-2">
                        {setResults.map((r, i) => (
                          <div
                            key={i}
                            className={`flex h-7 min-w-[5rem] items-center justify-center rounded-full px-3 text-[9px] font-black uppercase tracking-wider ${
                              r === "win"
                                ? "bg-emerald-50 text-emerald-600"
                                : r === "loss" || r === "timeout"
                                ? "bg-rose-50 text-rose-500"
                                : "bg-black/5 text-black/30"
                            }`}
                          >
                            Manche {i + 1}{" "}
                            {r === "win"
                              ? "✓"
                              : r === "loss" || r === "timeout"
                              ? "✗"
                              : "—"}
                          </div>
                        ))}
                      </div>

                      {wonSets > 0 && (
                        <p className="max-w-[30ch] text-[11px] font-semibold uppercase tracking-[0.18em] text-black/65">
                          Présentez votre ticket en caisse pour récupérer votre mascara
                        </p>
                      )}
                    </>
                  )}

                  <MotionButton
                    initial={{ scale: 0.92, opacity: 0, y: 8 }}
                    animate={
                      phase === "idle"
                        ? {
                            opacity: 1,
                            y: 0,
                            scale: 1,
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
                        ? {
                            boxShadow: {
                              duration: 2.4,
                              repeat: Infinity,
                              ease: "easeInOut",
                            },
                            default: {
                              type: "spring",
                              stiffness: 380,
                              damping: 24,
                              mass: 0.7,
                            },
                          }
                        : { type: "spring", stiffness: 380, damping: 24, mass: 0.7 }
                    }
                    whileHover={{
                      scale: 1.06,
                      y: -2,
                      transition: { type: "spring", stiffness: 520, damping: 24, mass: 0.6 },
                    }}
                    whileTap={{
                      scale: 0.94,
                      transition: { type: "spring", stiffness: 600, damping: 26 },
                    }}
                    onClick={startPlay}
                    className="wordmark px-12 py-4 text-[13px]"
                    style={{ backgroundColor: "var(--sephora-pink)" }}
                  >
                    {phase === "idle" ? "Commencer" : "Rejouer"}
                  </MotionButton>
                </motion.div>
              </motion.div>
            )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
