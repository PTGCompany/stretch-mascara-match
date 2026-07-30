import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import sephoraCollectionHorizontalAsset from "@/assets/sephora-header-logo.png.asset.json";
import sephoraDeliPinkAsset from "@/assets/sephora-deli-black.png.asset.json";
import { motion, AnimatePresence } from "framer-motion";
import { MotionButton } from "@/components/MotionButton";
import {
  SephoraToken,
  SephoraCollectionLogo,
  StripesMark,
  CircularSephoraMark,
} from "./icons";
import {
  saveSession,
  updateSessionPrintStatus,
  computeWinLevel,
  computeScore,
  generateTicketCode,
  type GameConfig,
  type CompletedReason,
} from "@/lib/game-config";
import {
  getKioskLaunch,
  resolveConfig,
  withLaunchSearch,
} from "@/lib/kiosk-launch";
import { buildBoard, type BoardCard } from "@/lib/game-products";
import { Link, useRouterState } from "@tanstack/react-router";
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
  // Router search (not window) so SSR/hydration honour ?kiosk=true — see kiosk-launch.ts
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const { kiosk } = getKioskLaunch(searchStr);
  const config = useMemo(() => resolveConfig(searchStr), [searchStr]);

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
  const [sessionId, setSessionId] = useState<string>("");
  const [ticketCode, setTicketCode] = useState<string>("");

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
      const id = crypto.randomUUID();
      const code = generateTicketCode();
      saveSession({
        id,
        pairsFound: finalPairs,
        totalPairs,
        wrongAttempts: finalWrong,
        finalWinLevel: tier?.level ?? null,
        rewardTierLabel: tier?.label ?? null,
        rewardTierMessage: tier?.message ?? null,
        rewardProductName: tier?.rewardProductName ?? null,
        score,
        timeRemaining: finalTimeRemaining,
        durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        ticketCode: code,
        printStatus: "NOT_REQUESTED",
        completedReason: reason,
        createdAt: Date.now(),
      });
      setSessionId(id);
      setTicketCode(code);
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
    if (status === "idle" || status === "rules") return 100;
    return 0;
  }, [status, timeRemaining, config.durationSeconds]);


  const timeUrgent = status === "playing" && timeRemaining <= 10;
  const overlayOpen = status === "idle" || status === "rules" || status === "completed" || status === "timeout";


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

  const printTicket = useCallback(() => {
    if (!sessionId) return;
    updateSessionPrintStatus(sessionId, "REQUESTED");
    // Must keep ?kiosk=&size= or the ticket page drops out of auto-print mode.
    window.location.assign(withLaunchSearch(`/print/game/${sessionId}`, searchStr));
  }, [sessionId, searchStr]);

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${config.gridCols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${config.gridRows}, minmax(0, 1fr))`,
  };

  return (
    <div className={`relative mx-auto flex min-h-dvh w-full max-w-[min(100vw,calc(100dvh*9/16))] flex-col overflow-hidden text-white ${status === "idle" ? "bg-[#ed6f7e]" : "bg-black"}`}>



      {/* TOP MARQUEE */}
      <div className={`relative z-20 flex h-10 items-center overflow-hidden border-b border-white/20 ${status === "idle" ? "bg-[#ed6f7e]" : "bg-black"}`}>
        <div
          className="relative flex shrink-0 items-center gap-10 whitespace-nowrap pl-10 will-change-transform"
          style={{ animation: `betc-marquee ${MARQUEE.topSec}s linear infinite` }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="flex items-center gap-10 whitespace-nowrap"
            >
              <img
                src={sephoraCollectionHorizontalAsset.url}
                alt="Sephora Collection"
                className="h-5 w-auto shrink-0 select-none"
                draggable={false}
              />
            </span>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="relative z-10 grid flex-1 min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 px-4 py-4">
        <div className="contents">


          {/* TOP — title + timer */}
          <section className="flex min-w-0 flex-col">
            <div className="flex items-start justify-between gap-3">
              <SephoraCollectionLogo color="#ffffff" size={32} className="shrink-0" />
              {/* Kiosk: invisible but clickable — lab can still open /admin without a visible cog */}
              <Link
                to="/admin"
                className={
                  kiosk
                    ? "opacity-0"
                    : "text-white/40 transition-colors hover:text-white"
                }
                aria-label="Admin"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
              className="font-display mt-2 text-[36px] uppercase leading-[0.85] tracking-tight text-white"
            >
              {config.title}{" "}
              <span style={{ color: PINK }}>{config.titleAccent}</span>
            </motion.h1>

            {/* Timer */}
            <div className="mt-3 w-full">
              <div className="flex items-end justify-between">
                <span
                  data-testid="time-remaining-label"
                  className="text-[9px] font-bold uppercase tracking-[0.32em] text-white/55"
                >
                  Time remaining
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
                  className="font-display text-[32px] leading-none tabular-nums tracking-tight"
                  style={{ color: timeUrgent ? PINK : "#ffffff" }}
                >
                  {status === "idle" || status === "rules"
                    ? fmtTime(config.durationSeconds)
                    : fmtTime(timeRemaining)}
                </motion.span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden bg-white/10">
                <motion.div
                  className="h-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.9, ease: "linear" }}
                  style={{ backgroundColor: PINK }}
                />
              </div>
            </div>
          </section>

          {/* CENTER — board */}
          <section className="flex min-h-0 flex-1 items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="relative border border-white/15 bg-white/[0.04] p-2 backdrop-blur-sm sm:p-3"
              style={{
                aspectRatio: `${config.gridCols} / ${config.gridRows}`,
                maxWidth: "100%",
                maxHeight: "100%",
                width: `min(100%, calc(100% * ${config.gridCols} / ${config.gridRows}))`,
              }}
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
                          className="absolute inset-0 overflow-hidden rounded-full"
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

          {/* BOTTOM — stats + tiers */}
          <section className="flex min-w-0 flex-col gap-2 border-t border-white/20 pt-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/55">
                  Pairs
                </span>
                <span
                  data-testid="pairs-count"
                  className="font-display text-[22px] leading-none tabular-nums"
                >
                  {pad2(pairsFound)}
                  <span className="text-white/30">/{pad2(totalPairs)}</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/55">
                  Points
                </span>
                <span
                  data-testid="current-score"
                  className="font-display text-[22px] leading-none tabular-nums"
                  style={{ color: pairsFound > 0 ? PINK : "rgba(255,255,255,0.4)" }}
                >
                  {liveScore}
                </span>
              </div>
              {config.trackWrongAttempts ? (
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/55">
                    Misses
                  </span>
                  <span className="font-display text-[22px] leading-none tabular-nums text-white/70">
                    {pad2(wrongAttempts)}
                  </span>
                </div>
              ) : (
                <div />
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              {config.winLevels.map((lv) => {
                const isReached =
                  currentTier != null && currentTier.level >= lv.level;
                const isCurrent =
                  currentTier != null && currentTier.level === lv.level;
                return (
                  <div
                    key={lv.level}
                    className="flex flex-1 min-w-0 items-center justify-between gap-1 border border-white/10 px-2 py-1"
                    style={
                      isCurrent
                        ? {
                            borderColor: PINK,
                            backgroundColor: "rgba(237,111,126,0.08)",
                          }
                        : undefined
                    }
                  >
                    <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/70">
                      T{lv.level}
                    </span>
                    <span
                      className="text-[9px] font-bold tabular-nums"
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
          </section>
        </div>
      </main>


      {/* BOTTOM MARQUEE */}
      <div className={`relative z-20 flex h-10 items-center overflow-hidden border-t border-white/20 ${status === "idle" ? "bg-[#ed6f7e]" : "bg-black"}`}>
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

      {/*
        Full-screen idle/rules/result shell.
        INTENTIONAL: key="screen-overlay" + initial={false} (opaque first paint).
        Do not key the shell by status or fade it from opacity 0 — that briefly
        shows the game board (cold-load flash and Start→rules flash). Inner card
        may still spring in; only this shell must stay opaque while overlayOpen.
      */}
      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            key="screen-overlay"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute inset-0 z-30 flex flex-col items-center gap-6 pt-10 backdrop-blur-md ${status === "idle" ? "bg-[#ed6f7e]" : "bg-black/90"}`}
          >
            {status === "idle" && (
              <motion.div
                // Keep opaque — fading this in from 0 clears the shell briefly
                initial={false}
                animate={{ opacity: 1 }}
                className="flex w-full flex-1 items-center justify-center overflow-hidden"
                style={{ backgroundColor: PINK }}
              >
                <img
                  src={sephoraDeliPinkAsset.url}
                  alt="Sephora Collection Deli — Made Fresh by Sephora Since 1996"
                  draggable={false}
                  className="h-full w-[55%] max-w-[360px] select-none object-contain object-center"
                  style={{ pointerEvents: "none" }}
                />
              </motion.div>
            )}
            <motion.div
              key={status}
              initial={{ y: 18, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 26,
                mass: 0.8,
                delay: 0.05,
              }}
              className={`relative mx-6 my-auto flex w-full max-w-xl flex-col items-center gap-6 border border-white/15 px-8 py-10 text-center sm:px-12 ${status === "idle" ? "bg-[#ed6f7e]" : "bg-black"}`}
            >
              <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b border-l" style={{ borderColor: PINK }} />
              <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r" style={{ borderColor: PINK }} />

              {status === "idle" && (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-white">
                    Sephora Collection · Memory Game
                  </span>
                  {/* Admin/debug grid summary — hide on venue kiosk (?kiosk=true) */}
                  {!kiosk && (
                    <p className="-mt-2 max-w-[36ch] text-[10px] font-bold uppercase tracking-[0.24em] text-white">
                      {config.gridCols}×{config.gridRows} — {totalPairs} pairs —{" "}
                      {config.durationSeconds}s
                    </p>
                  )}
                </>
              )}

              {status === "rules" && (
                <>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.32em]"
                    style={{ color: PINK }}
                  >
                    How to play
                  </span>
                  <h2 className="font-display text-[32px] uppercase leading-[0.9] text-white sm:text-[44px]">
                    Find the&nbsp;<span style={{ color: PINK }}>pairs</span>
                  </h2>
                  <ul className="flex max-w-[42ch] flex-col gap-3 text-left text-[12px] font-medium uppercase leading-relaxed tracking-[0.16em] text-white/75">
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black" style={{ backgroundColor: PINK, color: "#000" }}>1</span>
                      <span data-testid="rule-step-1">Tap a card to reveal a Sephora Collection product.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black" style={{ backgroundColor: PINK, color: "#000" }}>2</span>
                      <span data-testid="rule-step-2">Find the matching card to complete the pair.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black" style={{ backgroundColor: PINK, color: "#000" }}>3</span>
                      <span data-testid="rule-step-3">You have 30 seconds to find as many pairs as possible.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black" style={{ backgroundColor: PINK, color: "#000" }}>4</span>
                      <span data-testid="rule-step-4">Unlock rewards based on the number of pairs you find.</span>
                    </li>
                  </ul>
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
                        NO&nbsp;<span style={{ color: PINK }}>REWARD</span>
                        <span className="mt-2 block text-[14px] tracking-[0.28em] text-white/60">TRY AGAIN!</span>
                      </>
                    ) : (
                      <>{finalTier?.message ?? "WELL PLAYED!"}</>
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
                        {finalTier.label} · Tier {finalTier.level} / 3
                      </span>
                      {finalTier.gainDescription && (
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                          {finalTier.gainDescription}
                        </span>
                      )}
                    </div>
                  )}
                  {ticketCode && (
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.32em] text-white/55">
                      Ticket&nbsp;<span className="text-white" data-testid="ticket-code">{ticketCode}</span>
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
                  onClick={status === "idle" ? showRules : startPlay}
                  className="wordmark px-14 py-4 text-[12px] border-2 border-black"
                  style={{ backgroundColor: status === "idle" ? "#fff" : PINK, color: "#000" }}
                >
                  {status === "idle" ? "START TO ORDER" : status === "rules" ? "Play now" : "Play again"}
                </MotionButton>

                {status === "rules" && (
                  <MotionButton
                    onClick={goHome}
                    className="wordmark px-10 py-4 text-[12px] border border-white/30 text-white"
                    style={{ backgroundColor: "transparent" }}
                  >
                    Back
                  </MotionButton>
                )}

                {(status === "completed" || status === "timeout") && (
                  <>
                    {config.ticketPrintingEnabled &&
                      (finalTier || config.printNoRewardTicketEnabled) && (
                        <MotionButton
                          onClick={printTicket}
                          className="wordmark px-10 py-4 text-[12px]"
                          style={{ backgroundColor: "#fff", color: "#000" }}
                          data-testid="print-ticket"
                        >
                          Print my ticket
                        </MotionButton>
                      )}
                    <MotionButton
                      onClick={goHome}
                      className="wordmark px-10 py-4 text-[12px] border border-white/30 text-white"
                      style={{ backgroundColor: "transparent" }}
                    >
                      Home
                    </MotionButton>
                  </>
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


