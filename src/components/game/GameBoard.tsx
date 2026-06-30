import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionButton } from "@/components/MotionButton";
import {
  SephoraToken,
  SephoraCollectionLogo,
  StripesMark,
  CircularSephoraMark,
} from "./icons";
import {
  loadConfig,
  saveSession,
  computeWinLevel,
  computeScore,
  type GameConfig,
  type CompletedReason,
} from "@/lib/game-config";
import { buildBoard, type BoardCard } from "@/lib/game-products";
import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { MARQUEE } from "@/lib/motion";

type CardVisual = "hidden" | "flipped" | "matched";
type GameStatus = "idle" | "rules" | "playing" | "completed" | "timeout";


const PINK = "#ed6f7e";

function fmtTime(s: number) {
  const safe = Math.max(0, Math.floor(s));
  const m = Math.floor(safe / 60);
  const r = safe % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export function GameBoard() {
  const [config] = useState<GameConfig>(() => loadConfig());

  const total = config.gridRows * config.gridCols;
  const totalPairs = Math.min(config.totalPairs, Math.floor(total / 2));

  const [status, setStatus] = useState<GameStatus>("idle");
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [cardStates, setCardStates] = useState<CardVisual[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [pairsFound, setPairsFound] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [isCheckingPair, setIsCheckingPair] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(config.durationSeconds);
  const [completedReason, setCompletedReason] =
    useState<CompletedReason | null>(null);

  const startedAt = useRef<number>(0);
  const flipTimerRef = useRef<number | null>(null);
  const sessionSavedRef = useRef(false);

  const liveScore = useMemo(
    () => computeScore(pairsFound, timeRemaining, config),
    [pairsFound, timeRemaining, config],
  );

  const currentTier = useMemo(
    () => computeWinLevel(pairsFound, config.winLevels),
    [pairsFound, config.winLevels],
  );

  const startPlay = useCallback(() => {
    if (flipTimerRef.current) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
    const fresh = buildBoard(totalPairs);
    while (fresh.length < total) {
      const extra = fresh[fresh.length % fresh.length] ?? fresh[0];
      fresh.push({ ...extra, id: fresh.length });
    }
    setCards(fresh.slice(0, total));
    setCardStates(Array.from({ length: total }, () => "hidden"));
    setFlippedIds([]);
    setPairsFound(0);
    setWrongAttempts(0);
    setIsCheckingPair(false);
    setTimeRemaining(config.durationSeconds);
    setCompletedReason(null);
    sessionSavedRef.current = false;
    startedAt.current = Date.now();
    setStatus("playing");
  }, [total, totalPairs, config.durationSeconds]);

  const goHome = useCallback(() => {
    if (flipTimerRef.current) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
    setStatus("idle");
    setCards([]);
    setCardStates([]);
    setFlippedIds([]);
    setPairsFound(0);
    setWrongAttempts(0);
    setIsCheckingPair(false);
    setTimeRemaining(config.durationSeconds);
    setCompletedReason(null);
  }, [config.durationSeconds]);

  const showRules = useCallback(() => {
    setStatus("rules");
    setCards([]);
    setCardStates([]);
    setFlippedIds([]);
    setPairsFound(0);
    setWrongAttempts(0);
    setIsCheckingPair(false);
    setTimeRemaining(config.durationSeconds);
    setCompletedReason(null);
  }, [config.durationSeconds]);


  const finalizeGame = useCallback(
    (reason: CompletedReason, finalPairs: number, finalWrong: number, finalTimeRemaining: number) => {
      if (sessionSavedRef.current) return;
      sessionSavedRef.current = true;
      const tier = computeWinLevel(finalPairs, config.winLevels);
      const score = computeScore(finalPairs, finalTimeRemaining, config);
      saveSession({
        id: crypto.randomUUID(),
        pairsFound: finalPairs,
        totalPairs,
        wrongAttempts: finalWrong,
        finalWinLevel: tier?.level ?? null,
        score,
        timeRemaining: finalTimeRemaining,
        durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        completedReason: reason,
        createdAt: Date.now(),
      });
      setCompletedReason(reason);
      setStatus(reason === "PERFECT_SCORE" ? "completed" : "timeout");
    },
    [config, totalPairs],
  );

  const onTapCard = (idx: number) => {
    if (status !== "playing") return;
    if (isCheckingPair) return;
    const state = cardStates[idx];
    if (state !== "hidden") return;
    if (flippedIds.includes(idx)) return;

    const nextStates = [...cardStates];
    nextStates[idx] = "flipped";
    setCardStates(nextStates);

    const newFlipped = [...flippedIds, idx];
    setFlippedIds(newFlipped);

    if (newFlipped.length < 2) return;

    setIsCheckingPair(true);
    const [aIdx, bIdx] = newFlipped;
    const a = cards[aIdx];
    const b = cards[bIdx];
    const match = a.productId === b.productId;

    if (match) {
      window.setTimeout(() => {
        setCardStates((prev) => {
          const copy = [...prev];
          copy[aIdx] = "matched";
          copy[bIdx] = "matched";
          return copy;
        });
        const newPairs = pairsFound + 1;
        setPairsFound(newPairs);
        setFlippedIds([]);
        setIsCheckingPair(false);
        if (newPairs >= totalPairs) {
          finalizeGame("PERFECT_SCORE", newPairs, wrongAttempts, timeRemaining);
        }
      }, 320);
    } else {
      const newWrong = wrongAttempts + 1;
      if (config.trackWrongAttempts) setWrongAttempts(newWrong);
      flipTimerRef.current = window.setTimeout(() => {
        setCardStates((prev) => {
          const copy = [...prev];
          if (copy[aIdx] === "flipped") copy[aIdx] = "hidden";
          if (copy[bIdx] === "flipped") copy[bIdx] = "hidden";
          return copy;
        });
        setFlippedIds([]);
        setIsCheckingPair(false);
        flipTimerRef.current = null;
      }, config.flipBackDelayMs);
    }
  };

  useEffect(() => {
    if (status !== "playing") return;
    if (timeRemaining <= 0) {
      finalizeGame("TIMEOUT", pairsFound, wrongAttempts, 0);
      return;
    }
    const id = window.setTimeout(
      () => setTimeRemaining((t) => t - 1),
      1000,
    );
    return () => window.clearTimeout(id);
  }, [status, timeRemaining, finalizeGame, pairsFound, wrongAttempts]);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
    };
  }, []);

  const progress = useMemo(() => {
    if (status === "playing")
      return (timeRemaining / config.durationSeconds) * 100;
    if (status === "idle") return 100;
    return 0;
  }, [status, timeRemaining, config.durationSeconds]);

  const timeUrgent = status === "playing" && timeRemaining <= 10;
  const overlayOpen = status === "idle" || status === "completed" || status === "timeout";

  const finalTier = useMemo(
    () => computeWinLevel(pairsFound, config.winLevels),
    [pairsFound, config.winLevels],
  );

  const finalScore = useMemo(() => {
    if (status === "completed") {
      return computeScore(pairsFound, timeRemaining, config);
    }
    if (status === "timeout") {
      return computeScore(pairsFound, 0, config);
    }
    return liveScore;
  }, [status, pairsFound, timeRemaining, config, liveScore]);

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${config.gridCols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${config.gridRows}, minmax(0, 1fr))`,
  };

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-black text-white">
      {/* TOP MARQUEE */}
      <div className="relative z-20 flex h-10 items-center overflow-hidden border-b border-white/20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, #ffffff 0 1px, transparent 1px 14px)",
            backgroundSize: "200% 100%",
            animation: `betc-stripes-drift ${MARQUEE.stripeDriftSec}s linear infinite`,
            maskImage:
              "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
          }}
        />
        <div
          className="relative flex shrink-0 items-center gap-10 whitespace-nowrap pl-10 will-change-transform"
          style={{ animation: `betc-marquee ${MARQUEE.topSec}s linear infinite` }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="flex items-center gap-10 text-[11px] font-bold uppercase tracking-[0.32em] text-white"
            >
              <span>Sephora Collection</span>
              <StripesMark className="h-2.5 w-4 opacity-70" color="#ffffff" />
              <span className="text-white/70">Memory Game</span>
              <StripesMark className="h-2.5 w-4 opacity-70" color="#ffffff" />
            </span>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="relative z-10 flex flex-1 items-stretch justify-center px-5 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)_minmax(0,0.75fr)] lg:gap-8">
          {/* LEFT — title + timer */}
          <section className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col">
              <SephoraCollectionLogo color="#ffffff" size={16} />
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                className="font-display mt-4 text-[48px] uppercase leading-[0.85] tracking-tight sm:text-[64px] lg:text-[80px] text-white"
              >
                {config.title}{" "}
                <span style={{ color: PINK }}>{config.titleAccent}</span>
              </motion.h1>
              <p className="mt-4 max-w-[34ch] text-[10px] font-bold uppercase leading-relaxed tracking-[0.24em] text-white/55">
                {config.instruction}
              </p>
            </div>

            {/* Timer */}
            <div className="w-full max-w-md">
              <div className="flex items-end justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/55">
                  Temps restant
                </span>
                <motion.span
                  key={`${timeRemaining}-${status}`}
                  initial={{ scale: 1.12, opacity: 0.6 }}
                  animate={
                    timeUrgent
                      ? { scale: [1, 1.06, 1], opacity: 1 }
                      : { scale: 1, opacity: 1 }
                  }
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="font-display text-[44px] leading-none tabular-nums tracking-tight sm:text-[56px]"
                  style={{ color: timeUrgent ? PINK : "#ffffff" }}
                >
                  {status === "idle"
                    ? fmtTime(config.durationSeconds)
                    : fmtTime(timeRemaining)}
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

          {/* CENTER — board (4x5 by default) */}
          <section className="flex min-w-0 items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-[520px] border border-white/15 bg-white/[0.04] p-3 backdrop-blur-sm sm:p-4"
            >
              <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b border-l" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r" style={{ borderColor: PINK }} />

              <div className="grid gap-2 sm:gap-2.5" style={gridStyle}>
                {Array.from({ length: total }).map((_, i) => {
                  const card = cards[i];
                  const s = cardStates[i] ?? "hidden";
                  const isRevealed = s !== "hidden";
                  const isMatched = s === "matched";
                  const interactive =
                    status === "playing" && !isCheckingPair && s === "hidden";
                  const ariaLabel = !card
                    ? "Hidden card"
                    : isMatched
                      ? `Pair found, ${card.productName}`
                      : isRevealed
                        ? card.productName
                        : "Hidden card";
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={ariaLabel}
                      data-card-index={i}
                      data-card-state={s}
                      data-product-id={card?.productId ?? ""}
                      disabled={!interactive}
                      aria-disabled={!interactive}
                      onClick={() => onTapCard(i)}
                      className="group relative aspect-square w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sephora-pink)] disabled:cursor-not-allowed motion-reduce:transition-none"
                      style={{
                        perspective: 1000,
                        touchAction: "manipulation",
                      }}
                    >
                      <motion.div
                        animate={{ rotateY: isRevealed ? 180 : 0 }}
                        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0"
                        style={{
                          transformStyle: "preserve-3d",
                          willChange: "transform",
                          pointerEvents: "none",
                        }}
                      >
                        {/* back — Sephora token */}
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            backgroundColor: "#000",
                            boxShadow: interactive
                              ? "inset 0 0 0 1px rgba(255,255,255,0.4)"
                              : "inset 0 0 0 1px rgba(255,255,255,0.12)",
                          }}
                        >
                          <SephoraToken />
                        </div>
                        {/* front — product packshot */}
                        <div
                          className="absolute inset-0"
                          style={{
                            transform: "rotateY(180deg)",
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                          }}
                        >
                          <motion.div
                            animate={isMatched ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full"
                            style={{
                              backgroundColor: "#ffffff",
                              color: "#000",
                              boxShadow: isMatched
                                ? `0 0 0 2px ${PINK}, 0 10px 28px -8px rgba(237,111,126,0.55)`
                                : "0 0 0 1px rgba(0,0,0,0.1)",
                            }}
                          >
                            {card && (
                              <img
                                src={card.imageUrl}
                                alt={card.productName}
                                loading="lazy"
                                draggable={false}
                                className="h-[78%] w-[78%] select-none object-contain"
                              />
                            )}
                          </motion.div>
                        </div>
                      </motion.div>
                    </button>
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
                  Score
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
                <div className="flex items-center justify-between py-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/80">
                    Pairs
                  </span>
                  <span
                    data-testid="pairs-count"
                    className="font-display text-[28px] leading-none tabular-nums"
                  >
                    {pad2(pairsFound)}
                    <span className="text-white/30">/{pad2(totalPairs)}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/80">
                    Points
                  </span>
                  <span
                    data-testid="current-score"
                    className="font-display text-[28px] leading-none tabular-nums"
                    style={{ color: pairsFound > 0 ? PINK : "rgba(255,255,255,0.4)" }}
                  >
                    {liveScore}
                  </span>
                </div>
                {config.trackWrongAttempts && (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/80">
                      Misses
                    </span>
                    <span className="font-display text-[20px] leading-none tabular-nums text-white/70">
                      {pad2(wrongAttempts)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/20 pt-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
                Reward tiers
              </span>
              <div className="mt-3 flex flex-col gap-1.5">
                {config.winLevels.map((lv) => {
                  const isReached =
                    currentTier != null && currentTier.level >= lv.level;
                  const isCurrent =
                    currentTier != null && currentTier.level === lv.level;
                  return (
                    <div
                      key={lv.level}
                      className="flex items-center justify-between border border-white/10 px-2.5 py-1.5"
                      style={
                        isCurrent
                          ? {
                              borderColor: PINK,
                              backgroundColor: "rgba(237,111,126,0.08)",
                            }
                          : undefined
                      }
                    >
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">
                        Tier {lv.level}
                      </span>
                      <span
                        className="text-[10px] font-bold tabular-nums"
                        style={{
                          color: isReached ? PINK : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {lv.min}–{lv.max}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* BOTTOM MARQUEE */}
      <div className="relative z-20 flex h-10 items-center overflow-hidden border-t border-white/20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-115deg, #ffffff 0 1px, transparent 1px 14px)",
            backgroundSize: "200% 100%",
            animation: `betc-stripes-drift-reverse ${MARQUEE.stripeDriftReverseSec}s linear infinite`,
            maskImage:
              "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
          }}
        />
        <div
          className="relative flex shrink-0 items-center gap-10 whitespace-nowrap pl-10 will-change-transform"
          style={{
            animation: `betc-marquee-reverse ${MARQUEE.bottomSec}s linear infinite`,
          }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="flex items-center gap-10 text-[11px] font-bold uppercase tracking-[0.32em] text-white/70"
            >
              <span>Find the pairs</span>
              <StripesMark className="h-2.5 w-4 opacity-60" color="#ffffff" />
              <span className="text-white">{config.heroProductName}</span>
              <StripesMark className="h-2.5 w-4 opacity-60" color="#ffffff" />
            </span>
          ))}
        </div>
      </div>

      {/* Full-screen overlay (idle / result) */}
      <AnimatePresence mode="wait">
        {overlayOpen && (
          <motion.div
            key={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/85 backdrop-blur-md"
          >
            {status === "idle" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <CircularSephoraMark
                  size={140}
                  color="#ffffff"
                  durationSec={MARQUEE.logoSpinSec}
                />
              </motion.div>
            )}
            <motion.div
              initial={{ y: 18, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 26,
                mass: 0.8,
                delay: 0.05,
              }}
              className="relative mx-6 flex w-full max-w-xl flex-col items-center gap-6 border border-white/15 bg-black px-8 py-10 text-center sm:px-12"
            >
              <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b border-l" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r" style={{ borderColor: PINK }} />

              {status === "idle" && (
                <>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.32em]"
                    style={{ color: PINK }}
                  >
                    Sephora Collection · Memory Game
                  </span>
                  <h2 className="font-display text-[36px] uppercase leading-[0.9] text-white sm:text-[52px]">
                    Ready&nbsp;to&nbsp;<span style={{ color: PINK }}>play</span>?
                  </h2>
                  <p className="-mt-2 max-w-[36ch] text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">
                    {config.gridCols}×{config.gridRows} — {totalPairs} pairs —{" "}
                    {config.durationSeconds}s
                  </p>
                </>
              )}

              {(status === "completed" || status === "timeout") && (
                <>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.32em]"
                    style={{ color: PINK }}
                  >
                    {completedReason === "PERFECT_SCORE"
                      ? "Bravo — you found every pair!"
                      : "Time's up"}
                  </span>
                  <h2
                    data-testid="final-headline"
                    className="font-display text-[32px] uppercase leading-[0.95] text-white sm:text-[44px]"
                  >
                    {pairsFound === 0 ? (
                      <>
                        SO CLOSE,{" "}
                        <span style={{ color: PINK }}>
                          try&nbsp;again!
                        </span>
                      </>
                    ) : (
                      <>{finalTier?.message ?? "TIER 1 REWARD"}</>
                    )}
                  </h2>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="font-display text-[40px] uppercase leading-none tabular-nums text-white sm:text-[52px]"
                      data-testid="final-pairs"
                    >
                      {pairsFound}
                      <span className="text-white/40">/{totalPairs}</span>
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">
                      Pairs found
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      data-testid="final-score"
                      className="font-display text-[28px] leading-none tabular-nums"
                      style={{ color: PINK }}
                    >
                      {finalScore} pts
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
                      Final score
                    </div>
                  </div>
                  {finalTier && (
                    <div
                      data-testid="final-level"
                      className="mt-1 flex flex-col items-center gap-1 border px-5 py-3"
                      style={{ borderColor: PINK }}
                    >
                      <span
                        className="text-[11px] font-black uppercase tracking-[0.24em]"
                        style={{ color: PINK }}
                      >
                        Tier {finalTier.level} / 5
                      </span>
                      {finalTier.gainDescription && (
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                          {finalTier.gainDescription}
                        </span>
                      )}
                    </div>
                  )}
                  {config.trackWrongAttempts && (
                    <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
                      Misses: {wrongAttempts}
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                <MotionButton
                  onClick={startPlay}
                  className="wordmark px-14 py-4 text-[12px]"
                  style={{ backgroundColor: PINK, color: "#000" }}
                >
                  {status === "idle" ? "Start" : "Play again"}
                </MotionButton>

                {(status === "completed" || status === "timeout") && (
                  <MotionButton
                    onClick={goHome}
                    className="wordmark px-10 py-4 text-[12px] border border-white/30 text-white"
                    style={{ backgroundColor: "transparent" }}
                  >
                    Home
                  </MotionButton>
                )}
              </div>
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
        @keyframes betc-stripes-drift {
          from { background-position: 0% 0; }
          to { background-position: 200% 0; }
        }
        @keyframes betc-stripes-drift-reverse {
          from { background-position: 200% 0; }
          to { background-position: 0% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>
    </div>
  );
}
