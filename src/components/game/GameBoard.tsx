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
  type GameConfig,
  type CompletedReason,
} from "@/lib/game-config";
import { buildBoard, type BoardCard } from "@/lib/game-products";
import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { MARQUEE } from "@/lib/motion";

type CardVisual = "hidden" | "flipped" | "matched";
type GameStatus = "idle" | "playing" | "completed" | "timeout";

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

  const currentLevel = useMemo(
    () => computeWinLevel(pairsFound, config.winLevels),
    [pairsFound, config.winLevels],
  );

  const startPlay = useCallback(() => {
    if (flipTimerRef.current) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
    const fresh = buildBoard(totalPairs);
    // Pad with placeholders if total > 2*totalPairs (defensive — defaults match).
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
    setCardStates([]);
    setFlippedIds([]);
    setPairsFound(0);
    setWrongAttempts(0);
    setIsCheckingPair(false);
    setTimeRemaining(config.durationSeconds);
    setCompletedReason(null);
  }, [config.durationSeconds]);

  const finalizeGame = useCallback(
    (reason: CompletedReason, finalPairs: number, finalWrong: number) => {
      if (sessionSavedRef.current) return;
      sessionSavedRef.current = true;
      const level = computeWinLevel(finalPairs, config.winLevels);
      saveSession({
        id: crypto.randomUUID(),
        pairsFound: finalPairs,
        totalPairs,
        wrongAttempts: finalWrong,
        finalWinLevel: level?.level ?? null,
        durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        completedReason: reason,
        createdAt: Date.now(),
      });
      setCompletedReason(reason);
      setStatus(reason === "PERFECT_SCORE" ? "completed" : "timeout");
    },
    [config.winLevels, totalPairs],
  );

  // Tap handler
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

    // 2 cards flipped — evaluate pair
    setIsCheckingPair(true);
    const [aIdx, bIdx] = newFlipped;
    const a = cards[aIdx];
    const b = cards[bIdx];
    const match = a.productId === b.productId;

    if (match) {
      // Lock both as matched
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
          finalizeGame("PERFECT_SCORE", newPairs, wrongAttempts);
        }
      }, 320);
    } else {
      // Flip back after delay
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

  // Timer
  useEffect(() => {
    if (status !== "playing") return;
    if (timeRemaining <= 0) {
      finalizeGame("TIMEOUT", pairsFound, wrongAttempts);
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

  const finalLevel = useMemo(
    () => computeWinLevel(pairsFound, config.winLevels),
    [pairsFound, config.winLevels],
  );

  // Compute responsive grid card size
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

            {/* In-play score recap (subtle) */}
            <div className="mt-2 hidden flex-col gap-2 border-t border-white/15 pt-4 lg:flex">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
                  Paires trouvées
                </span>
                <span className="font-display text-[24px] leading-none tabular-nums">
                  {pad2(pairsFound)}
                  <span className="text-white/30">/{pad2(totalPairs)}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
                  Niveau
                </span>
                <span
                  className="font-display text-[24px] leading-none tabular-nums"
                  style={{ color: currentLevel ? PINK : "rgba(255,255,255,0.4)" }}
                >
                  {currentLevel ? pad2(currentLevel.level) : "—"}
                  <span className="text-white/30">/06</span>
                </span>
              </div>
            </div>
          </section>

          {/* CENTER — 8x8 board */}
          <section className="flex min-w-0 items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-[640px] border border-white/15 bg-white/[0.04] p-3 backdrop-blur-sm sm:p-4"
            >
              <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b border-l" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r" style={{ borderColor: PINK }} />

              <div className="grid gap-1.5 sm:gap-2" style={gridStyle}>
                {Array.from({ length: total }).map((_, i) => {
                  const card = cards[i];
                  const s = cardStates[i] ?? "hidden";
                  const isRevealed = s !== "hidden";
                  const isMatched = s === "matched";
                  const interactive =
                    status === "playing" && !isCheckingPair && s === "hidden";
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Card ${i + 1}`}
                      data-card-index={i}
                      data-card-state={s}
                      data-product-id={card?.productId ?? ""}
                      disabled={!interactive}
                      aria-disabled={!interactive}
                      onClick={() => onTapCard(i)}
                      className="group relative aspect-square w-full rounded-full focus-visible:outline-none disabled:cursor-not-allowed motion-reduce:transition-none"
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
                        {/* front — product face (rotated 180° so it shows when parent flips) */}
                        <motion.div
                          initial={{ rotateY: 180 }}
                          animate={{
                            rotateY: 180,
                            scale: isMatched ? [1, 1.08, 1] : 1,
                          }}
                          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-full p-1 text-center"
                          style={{
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            backgroundColor: "#ffffff",
                            color: "#000",
                            boxShadow: isMatched
                              ? `0 0 0 2px ${PINK}, 0 10px 28px -8px rgba(237,111,126,0.55)`
                              : "0 0 0 1px rgba(0,0,0,0.1)",
                          }}
                        >
                          {card && (
                            <>
                              <span
                                aria-hidden
                                className="text-[18px] leading-none sm:text-[22px]"
                              >
                                {card.emoji}
                              </span>
                              <span
                                className="mt-0.5 max-w-full truncate px-1 text-[5px] font-black uppercase leading-tight tracking-[0.06em] sm:text-[6px]"
                                title={card.productName}
                              >
                                {card.productName}
                              </span>
                              {card.isHeroProduct && (
                                <span
                                  className="mt-px text-[4px] font-bold uppercase tracking-[0.16em]"
                                  style={{ color: PINK }}
                                >
                                  ★ HERO
                                </span>
                              )}
                            </>
                          )}
                        </motion.div>
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
                    Paires
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
                    Niveau
                  </span>
                  <span
                    data-testid="current-level"
                    className="font-display text-[28px] leading-none tabular-nums"
                    style={{ color: currentLevel ? PINK : "rgba(255,255,255,0.4)" }}
                  >
                    {currentLevel ? pad2(currentLevel.level) : "—"}
                    <span className="text-white/30">/06</span>
                  </span>
                </div>
                {config.trackWrongAttempts && (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/80">
                      Erreurs
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
                Niveaux
              </span>
              <div className="mt-3 flex flex-col gap-1.5">
                {config.winLevels.map((lv) => {
                  const isReached =
                    currentLevel != null && currentLevel.level >= lv.level;
                  const isCurrent =
                    currentLevel != null && currentLevel.level === lv.level;
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
                        Niv. {lv.level}
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
              <span>Trouvez les paires</span>
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
                  <h2 className="font-display whitespace-nowrap text-[36px] uppercase leading-[0.9] text-white sm:text-[52px]">
                    Prêt(e)&nbsp;à&nbsp;<span style={{ color: PINK }}>jouer</span>&nbsp;?
                  </h2>
                  <p className="-mt-2 max-w-[36ch] text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">
                    Plateau 8×8 — {totalPairs} paires —{" "}
                    {config.durationSeconds}s — 6 niveaux à débloquer
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
                      ? "Score parfait"
                      : "Temps écoulé"}
                  </span>
                  <h2
                    data-testid="final-headline"
                    className="font-display text-[36px] uppercase leading-[0.95] text-white sm:text-[48px]"
                  >
                    {pairsFound === 0 ? (
                      <>
                        DOMMAGE,{" "}
                        <span style={{ color: PINK }}>
                          retentez votre&nbsp;chance&nbsp;!
                        </span>
                      </>
                    ) : (
                      <>
                        {finalLevel?.message ?? "BIEN JOUÉ !"}
                      </>
                    )}
                  </h2>
                  <div
                    className="font-display text-[48px] uppercase leading-none tabular-nums text-white sm:text-[64px]"
                    data-testid="final-pairs"
                  >
                    {pairsFound}
                    <span className="text-white/40">/{totalPairs}</span>
                  </div>
                  <div className="text-[12px] font-bold uppercase tracking-[0.28em] text-white/70">
                    Paires trouvées
                  </div>
                  {finalLevel && (
                    <div
                      data-testid="final-level"
                      className="mt-1 border px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em]"
                      style={{ borderColor: PINK, color: PINK }}
                    >
                      Niveau {finalLevel.level} / 6
                    </div>
                  )}
                  {config.trackWrongAttempts && (
                    <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
                      Erreurs : {wrongAttempts}
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
                  {status === "idle" ? "Commencer" : "Rejouer"}
                </MotionButton>

                {(status === "completed" || status === "timeout") && (
                  <MotionButton
                    onClick={goHome}
                    className="wordmark px-10 py-4 text-[12px] border border-white/30 text-white"
                    style={{ backgroundColor: "transparent" }}
                  >
                    Retour à l'accueil
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
