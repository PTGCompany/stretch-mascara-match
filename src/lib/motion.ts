/**
 * Global motion preset — single source of truth for all animations across the app.
 *
 * Every screen, overlay, and component should pull easing, duration, spring,
 * and loop values from here so that timing feels coherent everywhere.
 */

// ── Easing curves ──────────────────────────────────────────────────
/** Primary easing — smooth, slightly snappy. Use for almost everything. */
export const EASE = [0.22, 1, 0.36, 1] as const;
/** Sharper easing — for shakes, strokes, and abrupt feedback. */
export const EASE_SHARP = [0.65, 0, 0.35, 1] as const;
/** Wiggle / shake easing. */
export const EASE_WIGGLE = [0.36, 0.07, 0.19, 0.97] as const;

// ── Durations (seconds) ────────────────────────────────────────────
export const DURATION = {
  /** Tile reveals, instant feedback. */
  instant: 0.18,
  /** Buttons, labels, small element transitions. */
  fast: 0.22,
  /** Modal overlays, screen transitions. */
  base: 0.32,
  /** Hero entrances, title intros. */
  slow: 0.45,
  /** One-off splash sweeps. */
  splash: 1.4,
} as const;

// ── Springs ────────────────────────────────────────────────────────
export const SPRING = {
  /** Default UI spring — buttons, cards, modal pops. */
  default: { type: "spring" as const, stiffness: 420, damping: 26, mass: 0.7 },
  /** Hover lift. */
  hover: { type: "spring" as const, stiffness: 520, damping: 26, mass: 0.6 },
  /** Tap press. */
  tap: { type: "spring" as const, stiffness: 600, damping: 26 },
  /** Snappy entrance for tiles, badges. */
  snap: { type: "spring" as const, stiffness: 380, damping: 22, mass: 0.7 },
  /** Punchy bounce for celebratory marks. */
  punch: { type: "spring" as const, stiffness: 380, damping: 18 },
} as const;

// ── Infinite loops ─────────────────────────────────────────────────
/** Standard infinite repeat config used for marquees, pulses, glow loops. */
export const LOOP = {
  /** Soft repeating pulse (glow/ring). */
  pulse: { duration: 2.4, ease: "easeOut" as const, repeat: Infinity },
  /** Slower ambient breathing (idle button glow, halos). */
  breathe: { duration: 2.4, ease: "easeInOut" as const, repeat: Infinity },
  /** Fast halo pulse on revealed targets. */
  halo: { duration: 1.6, ease: "easeOut" as const, repeat: Infinity },
} as const;

/** Marquee CSS animation durations (seconds) — shared by both bars. */
export const MARQUEE = {
  topSec: 28,
  bottomSec: 74,
  stripeDriftSec: 14,
  stripeDriftReverseSec: 18,
  logoSpinSec: 28,
} as const;

/** Standard transitions composed from the primitives above. */
export const TRANSITION = {
  /** Default `{ duration, ease }` for most fade/slide animations. */
  base: { duration: DURATION.base, ease: EASE },
  fast: { duration: DURATION.fast, ease: EASE },
  instant: { duration: DURATION.instant, ease: EASE },
  slow: { duration: DURATION.slow, ease: EASE },
} as const;
