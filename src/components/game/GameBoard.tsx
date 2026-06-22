import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionButton } from "@/components/MotionButton";
import { MascaraIcon, SephoraToken, SephoraCollectionLogo, StripesMark } from "./icons";
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
type PlayPhase = "idle" | "setPlaying" | "setResult" | "mancheWin" | "playResult";

const SETS_PER_PLAY = 3;
const PINK = "#ffffff"; // brand-aligned accent (Sephora Collection is strictly monochrome)
const REVEAL_DURATION_MS = 180; // fast reveal so the mascara appears instantly

function buildTiles(total: number, targets: number): boolean[] {
  const arr = Array.from({ length: total }, (_, i) => i < targets);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fmtTime(s: number) {
  const m = Math.floor(Math.max(0, s) / 60);
  const r = Math.max(0, s) % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
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
  const [setFoundResults, setSetFoundResults] = useState<number[]>([0, 0, 0]);
  const setFoundResultsRef = useRef<number[]>([0, 0, 0]);
  const setResultsRef = useRef<SetResult[]>(["pending", "pending", "pending"]);
  const [timeLeft, setTimeLeft] = useState(config.durationSeconds);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [foundFlash, setFoundFlash] = useState(0);
  const startedAt = useRef<number>(0);
  const lockRef = useRef(false);
  const winDelayRef = useRef(false);
  const autoHomeTimerRef = useRef<number | null>(null);
  const total = config.gridCols * config.gridRows;

  const goHome = () => {
    if (autoHomeTimerRef.current) {
      window.clearTimeout(autoHomeTimerRef.current);
      autoHomeTimerRef.current = null;
    }
    lockRef.current = false;
    winDelayRef.current = false;
    setTicket(null);
    setShowTicket(false);
    setFoundFlash(0);
    setPhase("idle");
    setTimeLeft(config.durationSeconds);
  };

  const startPlay = () => {
    if (autoHomeTimerRef.current) {
      window.clearTimeout(autoHomeTimerRef.current);
      autoHomeTimerRef.current = null;
    }
    const cfg = loadConfig();
    const t = cfg.gridCols * cfg.gridRows;
    setTiles(buildTiles(t, cfg.targetsHidden));
    setStates(Array.from({ length: t }, () => "hidden"));
    setCurrentSet(1);
    setSetTriesUsed(0);
    setSetFound(0);
    const freshResults: SetResult[] = ["pending", "pending", "pending"];
    setSetResults(freshResults);
    setSetFoundResults([0, 0, 0]);
    setFoundResultsRef.current = [0, 0, 0];
    setResultsRef.current = freshResults;
    setTimeLeft(cfg.durationSeconds);
    setTicket(null);
    setShowTicket(false);
    setFoundFlash(0);
    startedAt.current = Date.now();
    lockRef.current = false;
    winDelayRef.current = false;
    setPhase("setPlaying");
  };

  const startSet = (setNum: number) => {
    setCurrentSet(setNum);
    setSetTriesUsed(0);
    setSetFound(0);
    setStates((prev) => prev.map(() => "hidden"));
    setTimeLeft(config.durationSeconds);
    lockRef.current = false;
    winDelayRef.current = false;
    setPhase("setPlaying");
  };

  const finishSet = (result: SetResult, found: number, _used: number) => {
    if (lockRef.current && result !== "win") return;
    lockRef.current = true;

    const nextResults = [...setResultsRef.current];
    nextResults[currentSet - 1] = result;
    setResultsRef.current = nextResults;
    setSetResults(nextResults);
    const nextFounds = [...setFoundResultsRef.current];
    nextFounds[currentSet - 1] = found;
    setFoundResultsRef.current = nextFounds;
    setSetFoundResults(nextFounds);

    if (result === "win") {
      // Issue (or reuse) the winning ticket and show the success screen.
      setTicket((prev) => prev ?? newTicket());
      setPhase("mancheWin");
      return;
    }

    setPhase("setResult");

    window.setTimeout(() => {
      if (currentSet < SETS_PER_PLAY) {
        startSet(currentSet + 1);
      } else {
        finalizeAndSave();
        setPhase("playResult");
      }
    }, 1600);
  };

  const finalizeAndSave = () => {
    const resultsNow = setResultsRef.current;
    const foundsNow = setFoundResultsRef.current;
    const playWon = resultsNow.some((r) => r === "win");
    const totalFound = foundsNow.reduce((acc, n) => acc + n, 0);
    const totalUsed = resultsNow.reduce((acc, r) => {
      if (r === "win") return acc + config.targetsRequired;
      if (r === "loss" || r === "timeout") return acc + config.attemptsAllowed;
      return acc;
    }, 0);
    saveSession({
      id: crypto.randomUUID(),
      result: (playWon ? "WIN" : "LOSS") as SessionResult,
      targetsFound: totalFound,
      attemptsUsed: totalUsed,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      createdAt: Date.now(),
      ticketCode: playWon ? ticket?.code : undefined,
    });
  };

  const continueAfterWin = () => {
    if (autoHomeTimerRef.current) {
      window.clearTimeout(autoHomeTimerRef.current);
      autoHomeTimerRef.current = null;
    }
    if (currentSet < SETS_PER_PLAY) {
      startSet(currentSet + 1);
    } else {
      finalizeAndSave();
      setPhase("playResult");
    }
  };

  const onTap = (i: number) => {
    if (phase !== "setPlaying" || lockRef.current || winDelayRef.current) return;
    if (states[i] !== "hidden") return;

    const isTarget = tiles[i];
    const nextStates = [...states];
    nextStates[i] = isTarget ? "revealed-target" : "revealed-empty";
    setStates(nextStates);

    const newFound = isTarget ? setFound + 1 : setFound;
    const newTries = setTriesUsed + 1;
    if (isTarget) {
      setSetFound(newFound);
      // flash starts only after the tile reveal completes
      window.setTimeout(() => {
        setFoundFlash((n) => n + 1);
      }, REVEAL_DURATION_MS);
    }
    setSetTriesUsed(newTries);

    if (newFound >= config.targetsRequired) {
      lockRef.current = true;
      winDelayRef.current = true;
      window.setTimeout(() => {
        lockRef.current = false;
        winDelayRef.current = false;
        finishSet("win", newFound, newTries);
      }, 2000);
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
  };

  useEffect(() => {
    if (phase !== "setPlaying") return;
    if (timeLeft <= 0) {
      finishSet("timeout", setFound, setTriesUsed);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timeLeft, finishSet, setFound, setTriesUsed]);

  // Auto-return to home after end-of-session result screen (only when no ticket overlay)
  useEffect(() => {
    if (phase !== "playResult" || ticket) return;
    autoHomeTimerRef.current = window.setTimeout(() => goHome(), 12000);
    return () => {
      if (autoHomeTimerRef.current) {
        window.clearTimeout(autoHomeTimerRef.current);
        autoHomeTimerRef.current = null;
      }
    };
  }, [phase, ticket]);

  // Cancel auto-home timer on any user interaction (touch/click) while result overlay is open
  useEffect(() => {
    if (phase !== "playResult" || ticket) return;
    const cancelAutoHome = () => {
      if (autoHomeTimerRef.current) {
        window.clearTimeout(autoHomeTimerRef.current);
        autoHomeTimerRef.current = null;
      }
    };
    document.addEventListener("pointerdown", cancelAutoHome);
    return () => document.removeEventListener("pointerdown", cancelAutoHome);
  }, [phase, ticket]);

  const progress = useMemo(
    () =>
      phase === "setPlaying"
        ? (timeLeft / config.durationSeconds) * 100
        : phase === "idle"
        ? 100
        : 0,
    [phase, timeLeft, config.durationSeconds]
  );

  const wonSets = useMemo(
    () => setResults.filter((r) => r === "win").length,
    [setResults]
  );

  const timeUrgent = phase === "setPlaying" && timeLeft <= 5;
  const overlayOpen =
    (phase === "idle" || phase === "setResult" || phase === "playResult") &&
    !(phase === "playResult" && ticket);

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-black text-white">
      {/* TOP MARQUEE */}
      <div
        className="relative z-20 flex h-10 items-center overflow-hidden border-b"
        style={{ borderColor: "rgba(237,111,126,0.3)" }}
      >
        <div
          className="flex shrink-0 items-center gap-10 whitespace-nowrap pl-10 will-change-transform"
          style={{ animation: "betc-marquee 28s linear infinite" }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.32em]"
            >
              <span style={{ color: PINK }}>Sephora Collection</span>
              <span aria-hidden className="opacity-40">
                ✦
              </span>
              <span className="text-white">Memory Game</span>
              <span aria-hidden className="opacity-40">
                ✦
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="relative z-10 flex flex-1 items-stretch justify-center px-5 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)_minmax(0,0.85fr)] lg:gap-10">
          {/* LEFT — title + timer */}
          <section className="flex min-w-0 flex-col gap-8">
            <div className="flex flex-col">
              <motion.span
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="wordmark text-[13px] text-white/70"
              >
                SEPHORA COLLECTION
              </motion.span>
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                className="font-display mt-3 text-[64px] uppercase leading-[0.85] tracking-tight sm:text-[88px] lg:text-[104px]"
              >
                {config.title}
                <br />
                <span style={{ color: PINK }}>{config.titleAccent}</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.18, duration: 0.3 }}
                className="mt-5 max-w-[34ch] text-[10px] font-bold uppercase leading-relaxed tracking-[0.28em] text-white/55"
              >
                3 manches — {config.attemptsAllowed} essais — {config.targetsRequired} mascaras à trouver
              </motion.p>
            </div>

            {/* Timer */}
            <div className="w-full max-w-md">
              <div className="flex items-end justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/55">
                  Temps restant
                </span>
                <motion.span
                  key={timeLeft + phase}
                  initial={{ scale: 1.12, opacity: 0.6 }}
                  animate={
                    timeUrgent
                      ? { scale: [1, 1.06, 1], opacity: 1 }
                      : { scale: 1, opacity: 1 }
                  }
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="font-display text-[56px] leading-none tabular-nums tracking-tight sm:text-[68px]"
                  style={{ color: timeUrgent ? "#ff1f8a" : PINK }}
                >
                  {phase === "idle"
                    ? fmtTime(config.durationSeconds)
                    : fmtTime(timeLeft)}
                </motion.span>
              </div>
              <div className="mt-3 h-[3px] w-full overflow-hidden bg-white/10">
                <motion.div
                  className="h-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.9, ease: "linear" }}
                  style={{ backgroundColor: PINK }}
                />
              </div>
            </div>
          </section>

          {/* CENTER — grid */}
          <section className="flex min-w-0 items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-[460px] border border-white/15 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-7"
            >
              {/* corner ticks */}
              <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b border-l" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r" style={{ borderColor: PINK }} />

              <div
                className="grid gap-3 sm:gap-4"
                style={{
                  gridTemplateColumns: `repeat(${config.gridCols}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: total }).map((_, i) => {
                  const s = states[i] ?? "hidden";
                  const isRevealed = s !== "hidden";
                  const isTarget = s === "revealed-target";
                  const isWrong = s === "revealed-empty";
                  const interactive = phase === "setPlaying" && !isRevealed;
                  const dimmed = !interactive && !isRevealed;
                  return (
                    <MotionButton
                      key={i}
                      initial={{ opacity: 0, scale: 0.6, y: 8 }}
                      animate={{
                        opacity: dimmed ? 0.32 : 1,
                        scale: 1,
                        y: 0,
                        x: isWrong ? [0, -4, 4, -2, 2, 0] : 0,
                        filter: dimmed ? "grayscale(0.7)" : "grayscale(0)",
                      }}
                      transition={{
                        opacity: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                        filter: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                        scale: {
                          delay: Math.min(0.22, 0.04 + i * 0.022),
                          type: "spring",
                          stiffness: 380,
                          damping: 22,
                          mass: 0.7,
                        },
                        y: {
                          delay: Math.min(0.22, 0.04 + i * 0.022),
                          type: "spring",
                          stiffness: 380,
                          damping: 22,
                        },
                        x: isWrong
                          ? { duration: 0.4, ease: [0.36, 0.07, 0.19, 0.97] }
                          : { duration: 0 },
                      }}
                      whileTap={interactive ? { scale: 0.92 } : { scale: 1 }}
                      whileHover={
                        interactive ? { scale: 1.06, y: -3 } : { scale: 1 }
                      }
                      onClick={() => onTap(i)}
                      disabled={!interactive}
                      aria-label={`Token ${i + 1}`}
                      aria-disabled={!interactive}
                      intent="token"
                      className={
                        interactive ? "cursor-pointer" : "cursor-not-allowed"
                      }
                      style={{
                        perspective: 1200,
                        touchAction: "manipulation",
                      }}
                    >
                      <motion.div
                        animate={{ rotateY: isRevealed ? 180 : 0 }}
                        transition={{
                          rotateY: {
                            duration: 0.18,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }}
                        className="absolute inset-0"
                        style={{
                          transformStyle: "preserve-3d",
                          willChange: "transform",
                          pointerEvents: "none",
                        }}
                      >
                        {/* back — brand-aligned monochrome token (black with stripes) */}
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            backgroundColor: "#000000",
                            boxShadow: interactive
                              ? "inset 0 0 0 1px rgba(255,255,255,0.55), 0 12px 28px -10px rgba(255,255,255,0.25)"
                              : "inset 0 0 0 1px rgba(255,255,255,0.18), 0 4px 14px -8px rgba(0,0,0,0.6)",
                            transition: "box-shadow 0.4s cubic-bezier(0.22,1,0.36,1)",
                          }}
                        >
                          <SephoraToken />
                          {interactive && (
                            <motion.span
                              className="pointer-events-none absolute inset-0 rounded-full"
                              initial={{ opacity: 0, scale: 1 }}
                              animate={{
                                opacity: [0, 0.5, 0],
                                scale: [1, 1.08, 1.14],
                              }}
                              transition={{
                                duration: 2.4,
                                ease: "easeOut",
                                repeat: Infinity,
                                delay: (i % 6) * 0.18,
                              }}
                              style={{ boxShadow: `0 0 0 1px #ffffff` }}
                            />
                          )}
                        </div>
                        {/* front — revealed */}
                        <motion.div
                          animate={
                            isTarget
                              ? { scale: [0.86, 1.14, 1], rotate: [0, -2, 2, 0] }
                              : isWrong
                              ? { scale: [0.9, 1, 0.98] }
                              : { scale: 1 }
                          }
                          transition={{
                            duration: 0.45,
                            ease: [0.22, 1, 0.36, 1],
                            delay: 0.18,
                          }}
                          className="absolute inset-0 rounded-full"
                          style={{
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            transform: "rotateY(180deg)",
                            backgroundColor: isWrong ? "#f2f2f2" : "#ffffff",
                            boxShadow: isTarget
                              ? `0 0 0 3px #34d399, 0 18px 40px -8px rgba(52,211,153,0.7)`
                              : isWrong
                              ? "inset 0 0 0 1px rgba(0,0,0,0.12), 0 6px 18px -10px rgba(0,0,0,0.35)"
                              : "0 0 0 1px rgba(0,0,0,0.1)",
                          }}
                        >
                          {isTarget && (
                            <motion.span
                              className="pointer-events-none absolute inset-0 rounded-full"
                              initial={{ opacity: 0, scale: 1 }}
                              animate={{ opacity: [0, 0.6, 0], scale: [1, 1.12, 1.22] }}
                              transition={{ duration: 1.6, ease: "easeOut", repeat: Infinity, delay: 0.18 }}
                              style={{ boxShadow: `0 0 0 3px #34d399` }}
                            />
                          )}
                          {isTarget && (
                            <motion.span
                              className="pointer-events-none absolute inset-0 rounded-full"
                              initial={{ opacity: 0, scale: 1 }}
                              animate={{ opacity: [0, 0.35, 0], scale: [1, 1.06, 1.10] }}
                              transition={{ duration: 1.6, ease: "easeOut", repeat: Infinity, delay: 0.5 + 0.18 }}
                              style={{ boxShadow: `0 0 0 2px #34d399` }}
                            />
                          )}
                          {/* clean reveal — mascara only, no badge overlay */}

                          {isTarget ? (
                            <div className="absolute inset-0 m-auto flex items-center justify-center">
                              <MascaraIcon className="h-[80%] w-[80%]" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 m-auto flex items-center justify-center">
                              <motion.svg
                                viewBox="0 0 24 24"
                                className="h-[36%] w-[36%]"
                                fill="none"
                                stroke="#111"
                                strokeWidth={2.4}
                                strokeLinecap="round"
                              >
                                <motion.path
                                  d="M5 5 L19 19"
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={
                                    isWrong
                                      ? { pathLength: 1, opacity: 1 }
                                      : { pathLength: 0, opacity: 0 }
                                  }
                                  transition={{
                                    duration: 0.32,
                                    ease: [0.65, 0, 0.35, 1],
                                    delay: 0.18,
                                  }}
                                />
                                <motion.path
                                  d="M19 5 L5 19"
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={
                                    isWrong
                                      ? { pathLength: 1, opacity: 1 }
                                      : { pathLength: 0, opacity: 0 }
                                  }
                                  transition={{
                                    duration: 0.32,
                                    ease: [0.65, 0, 0.35, 1],
                                    delay: 0.3,
                                  }}
                                />
                              </motion.svg>
                            </div>
                          )}
                        </motion.div>
                      </motion.div>
                    </MotionButton>
                  );
                })}
              </div>
            </motion.div>
          </section>

          {/* RIGHT — status sidebar */}
          <aside className="flex min-w-0 flex-col gap-6">
            <div className="border-t border-white/20 pt-4">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.28em]"
                  style={{ color: PINK }}
                >
                  Statut
                </span>
                <Link
                  to="/admin"
                  className="text-white/40 transition-colors hover:text-white"
                  aria-label="Admin"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-5 divide-y divide-white/10">
                <div className="flex items-center justify-between py-4">
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/80">
                    Manche
                  </span>
                  <span className="font-display text-[28px] leading-none tabular-nums">
                    {pad2(currentSet)}
                    <span className="text-white/30">/{pad2(SETS_PER_PLAY)}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between py-4">
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/80">
                    Essai
                  </span>
                  <span className="font-display text-[28px] leading-none tabular-nums">
                    {pad2(setTriesUsed)}
                    <span className="text-white/30">/{pad2(config.attemptsAllowed)}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between py-4">
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/80">
                    Trouvés
                  </span>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: config.targetsRequired }).map((_, i) => (
                      <div
                        key={i}
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            i < setFound ? PINK : "rgba(255,255,255,0.18)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/20 pt-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
                Manches
              </span>
              <div className="mt-4 flex gap-2">
                {setResults.map((r, i) => {
                  const isCurrent = i === currentSet - 1 && phase === "setPlaying";
                  return (
                    <div
                      key={i}
                      className="flex flex-1 flex-col items-center gap-2 border border-white/15 px-2 py-3"
                      style={
                        isCurrent
                          ? { borderColor: PINK, backgroundColor: "rgba(237,111,126,0.08)" }
                          : undefined
                      }
                    >
                      <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/50">
                        M{i + 1}
                      </span>
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            r === "win"
                              ? "#34d399"
                              : r === "loss" || r === "timeout"
                              ? "#fb7185"
                              : isCurrent
                              ? PINK
                              : "rgba(255,255,255,0.18)",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* BOTTOM MARQUEE */}
      <div
        className="relative z-20 flex h-10 items-center overflow-hidden border-t"
        style={{ borderColor: "rgba(237,111,126,0.3)" }}
      >
        <div
          className="flex shrink-0 items-center gap-10 whitespace-nowrap pl-10 will-change-transform"
          style={{ animation: "betc-marquee-reverse 32s linear infinite" }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.32em] text-white/45"
            >
              <span>Trouvez les mascaras</span>
              <span aria-hidden>—</span>
              <span style={{ color: PINK, opacity: 0.7 }}>It's a Stretch</span>
              <span aria-hidden>—</span>
            </span>
          ))}
        </div>
      </div>

      {/* MASCARA TROUVÉ flash — clear feedback every time a target tile is revealed */}
      <AnimatePresence>
        {foundFlash > 0 && phase === "setPlaying" && (
          <motion.div
            key={foundFlash}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", stiffness: 360, damping: 22, mass: 0.7 }}
            className="pointer-events-none absolute inset-x-0 top-14 z-30 flex justify-center px-4"
            onAnimationComplete={() => {
              window.setTimeout(() => setFoundFlash(0), 1100);
            }}
          >
            <div
              className="flex items-center gap-3 border-2 px-6 py-3 backdrop-blur-md"
              style={{
                backgroundColor: "rgba(52,211,153,0.18)",
                borderColor: "#34d399",
                boxShadow: "0 0 40px rgba(52,211,153,0.55)",
              }}
            >
              <motion.span
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: "#34d399" }}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </motion.span>
              <span
                className="font-display text-[28px] uppercase leading-none tracking-tight sm:text-[36px]"
                style={{ color: "#34d399" }}
              >
                Mascara trouvé !
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Ticket overlay — auto on manche win; on demand at end (via "Voir mon ticket") */}
      {ticket && (phase === "mancheWin" || (phase === "playResult" && showTicket)) && (
        <Ticket
          data={ticket}
          config={config}
          onClose={goHome}
          onReplay={startPlay}
          onContinue={
            phase === "mancheWin"
              ? continueAfterWin
              : () => setShowTicket(false)
          }
          continueLabel={
            phase === "mancheWin"
              ? currentSet < SETS_PER_PLAY
                ? `Manche ${currentSet + 1}`
                : "Voir le résultat"
              : "Retour au résultat"
          }
          title={
            phase === "mancheWin"
              ? `MANCHE ${currentSet} GAGNÉE —`
              : undefined
          }
        />
      )}

      {/* Full-screen modal overlay */}
      <AnimatePresence mode="wait">
        {overlayOpen && (
          <motion.div
            key={phase + currentSet}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 18, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -10, opacity: 0, scale: 0.97 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 26,
                mass: 0.8,
                delay: 0.05,
              }}
              className="relative mx-6 flex w-full max-w-xl flex-col items-center gap-6 border border-white/15 bg-black px-8 py-10 text-center sm:px-12"
            >
              <span
                className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l border-t"
                style={{ borderColor: PINK }}
              />
              <span
                className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t"
                style={{ borderColor: PINK }}
              />
              <span
                className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b border-l"
                style={{ borderColor: PINK }}
              />
              <span
                className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r"
                style={{ borderColor: PINK }}
              />

              {phase === "idle" && (
                <>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.32em]"
                    style={{ color: PINK }}
                  >
                    Sephora Collection · Memory Game
                  </span>
                  <h2 className="font-display text-[44px] uppercase leading-[0.9] text-white sm:text-[60px]">
                    PRÊT(E) À{" "}
                    <span style={{ color: PINK }}>JOUER</span> ?
                  </h2>
                  <p className="-mt-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
                    3 manches — {config.attemptsAllowed} essais — {config.targetsRequired} mascaras
                  </p>
                </>
              )}

              {phase === "setResult" && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex flex-col items-center gap-3"
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.32em]"
                    style={{ color: PINK }}
                  >
                    Résultat — Manche {currentSet}
                  </span>
                  <div
                    className="font-display text-[56px] uppercase leading-none sm:text-[72px]"
                    style={{
                      color:
                        setResults[currentSet - 1] === "win" ? "#34d399" : "#ffffff",
                    }}
                  >
                    {setResults[currentSet - 1] === "win"
                      ? "GAGNÉ"
                      : setResults[currentSet - 1] === "timeout"
                      ? "TEMPS ÉCOULÉ"
                      : "PERDU"}
                  </div>
                  <div
                    className="font-display text-[24px] uppercase leading-none tabular-nums text-white sm:text-[28px]"
                  >
                    {setFoundResults[currentSet - 1]}/{config.targetsRequired}{" "}
                    <span className="text-white/60">trouvé{setFoundResults[currentSet - 1] > 1 ? "s" : ""}</span>
                  </div>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
                    {currentSet < SETS_PER_PLAY
                      ? `Manche ${currentSet + 1} dans un instant…`
                      : "Résultat final…"}
                  </p>
                </motion.div>
              )}

              {phase === "playResult" && (
                <>
                  <motion.h2
                    initial={{ x: 0 }}
                    animate={
                      wonSets === 0 ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }
                    }
                    transition={{
                      duration: 0.5,
                      ease: [0.36, 0.07, 0.19, 0.97],
                      delay: 0.1,
                    }}
                    className="font-display text-[36px] uppercase leading-[0.95] text-white sm:text-[44px]"
                  >
                    {wonSets > 0 ? (
                      <>
                        BRAVO,
                        <br />
                        <span style={{ color: PINK }}>
                          {wonSets}/3 MANCHES GAGNÉES
                        </span>
                      </>
                    ) : (
                      <>
                        DOMMAGE,
                        <br />
                        <span style={{ color: PINK }}>
                          RETENTEZ VOTRE CHANCE !
                        </span>
                      </>
                    )}
                  </motion.h2>

                  <div className="flex gap-2">
                    {setResults.map((r, i) => (
                      <div
                        key={i}
                        className="flex h-8 min-w-[5rem] items-center justify-center gap-1 border px-3 text-[9px] font-black uppercase tracking-[0.2em]"
                        style={{
                          borderColor:
                            r === "win"
                              ? "#34d399"
                              : r === "loss" || r === "timeout"
                              ? "#fb7185"
                              : "rgba(255,255,255,0.15)",
                          color:
                            r === "win"
                              ? "#34d399"
                              : r === "loss" || r === "timeout"
                              ? "#fb7185"
                              : "rgba(255,255,255,0.4)",
                        }}
                      >
                        M{i + 1}{" "}
                        {r === "win" ? "✓" : r === "loss" || r === "timeout" ? "✗" : "—"}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
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
                    scale: 1.05,
                    y: -2,
                    transition: { type: "spring", stiffness: 520, damping: 24, mass: 0.6 },
                  }}
                  whileTap={{
                    scale: 0.94,
                    transition: { type: "spring", stiffness: 600, damping: 26 },
                  }}
                  onClick={startPlay}
                  className="wordmark px-14 py-4 text-[12px]"
                  style={{ backgroundColor: PINK, color: "#000" }}
                >
                  {phase === "idle" ? "Commencer" : "Rejouer"}
                </MotionButton>

                {phase === "playResult" && ticket && (
                  <MotionButton
                    initial={{ scale: 0.92, opacity: 0, y: 8 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 24, mass: 0.7 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setShowTicket(true)}
                    className="wordmark px-10 py-4 text-[12px]"
                    style={{ backgroundColor: "#34d399", color: "#000" }}
                  >
                    Voir mon ticket
                  </MotionButton>
                )}

                {phase === "playResult" && (
                  <MotionButton
                    initial={{ scale: 0.92, opacity: 0, y: 8 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 24, mass: 0.7, delay: 0.05 }}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={goHome}
                    className="wordmark px-10 py-4 text-[12px] border border-white/30 text-white"
                    style={{ backgroundColor: "transparent" }}
                  >
                    Retour à l'accueil
                  </MotionButton>
                )}
              </div>

              {phase === "playResult" && (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
                  Retour automatique à l'accueil dans quelques secondes…
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* keyframes */}
      <style>{`
        @keyframes betc-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes betc-marquee-reverse {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
