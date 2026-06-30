export type WinLevel = {
  level: number;
  min: number;
  max: number;
  message: string;
  gainDescription?: string;
};

export type GameConfig = {
  title: string;
  titleAccent: string;
  instruction: string;
  heroProductName: string;
  durationSeconds: number;
  gridRows: number;
  gridCols: number;
  totalPairs: number;
  flipBackDelayMs: number;
  trackWrongAttempts: boolean;
  pointsPerPair: number;
  timeBonusEnabled: boolean;
  timeBonusPointsPerSecond: number;
  winLevels: WinLevel[];
  brandColor: string;
};

/**
 * Reward tiers (stored as `winLevels` for backwards compatibility).
 * 0-pair case ("SO CLOSE…") is handled at render time, not as a tier.
 */
export const DEFAULT_WIN_LEVELS: WinLevel[] = [
  { level: 1, min: 1, max: 2, message: "TIER 1 REWARD", gainDescription: "Discovery sample" },
  { level: 2, min: 3, max: 4, message: "TIER 2 REWARD", gainDescription: "Mini skincare format" },
  { level: 3, min: 5, max: 6, message: "TIER 3 REWARD", gainDescription: "Beauty pouch" },
  { level: 4, min: 7, max: 8, message: "TIER 4 REWARD", gainDescription: "Sephora Collection product" },
  { level: 5, min: 9, max: 10, message: "TIER 5 REWARD", gainDescription: "Signature gift set" },
];

export const DEFAULT_CONFIG: GameConfig = {
  title: "MEMORY",
  titleAccent: "GAME",
  instruction:
    "FIND AS MANY PAIRS AS YOU CAN IN 30 SECONDS!",
  heroProductName: "IT'S A STRETCH",
  durationSeconds: 30,
  gridRows: 5,
  gridCols: 4,
  totalPairs: 10,
  flipBackDelayMs: 900,
  trackWrongAttempts: true,
  pointsPerPair: 100,
  timeBonusEnabled: true,
  timeBonusPointsPerSecond: 10,
  winLevels: DEFAULT_WIN_LEVELS,
  brandColor: "#ed6f7e",
};

const KEY = "sephora-game-config-v7";

export function loadConfig(): GameConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<GameConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      winLevels:
        Array.isArray(parsed.winLevels) && parsed.winLevels.length === 5
          ? parsed.winLevels
          : DEFAULT_WIN_LEVELS,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(c: GameConfig) {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export function validateWinLevels(levels: WinLevel[]): string | null {
  if (levels.length !== 5) return "There must be exactly 5 reward tiers.";
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    if (lv.min < 1) return `Tier ${i + 1}: min ≥ 1.`;
    if (lv.max < lv.min) return `Tier ${i + 1}: max ≥ min.`;
    if (i > 0 && lv.min <= levels[i - 1].max)
      return `Tier ${i + 1}: must start after the previous one.`;
  }
  if (levels[4].max > 10) return "Tier 5: max ≤ 10.";
  return null;
}

export function computeWinLevel(
  pairsFound: number,
  levels: WinLevel[],
): WinLevel | null {
  if (pairsFound <= 0) return null;
  for (const lv of levels) {
    if (pairsFound >= lv.min && pairsFound <= lv.max) return lv;
  }
  return null;
}

export function computeScore(
  pairsFound: number,
  timeRemaining: number,
  config: Pick<GameConfig, "pointsPerPair" | "timeBonusEnabled" | "timeBonusPointsPerSecond" | "totalPairs">,
): number {
  const base = pairsFound * config.pointsPerPair;
  const bonus =
    config.timeBonusEnabled && pairsFound >= config.totalPairs
      ? Math.max(0, timeRemaining) * config.timeBonusPointsPerSecond
      : 0;
  return base + bonus;
}

export type CompletedReason = "TIMEOUT" | "PERFECT_SCORE" | "MANUAL_RESTART";

export type GameSession = {
  id: string;
  pairsFound: number;
  totalPairs: number;
  wrongAttempts: number;
  finalWinLevel: number | null;
  score: number;
  timeRemaining: number;
  durationSeconds: number;
  completedReason: CompletedReason;
  createdAt: number;
};

const SESS_KEY = "sephora-game-sessions-v3";

export function loadSessions(): GameSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SESS_KEY) ?? "[]") as GameSession[];
  } catch {
    return [];
  }
}

export function saveSession(s: GameSession) {
  const all = loadSessions();
  all.unshift(s);
  localStorage.setItem(SESS_KEY, JSON.stringify(all.slice(0, 500)));
}

export function clearSessions() {
  localStorage.removeItem(SESS_KEY);
}
