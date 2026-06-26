export type WinLevel = {
  level: number;
  min: number;
  max: number;
  message: string;
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
  winLevels: WinLevel[];
  brandColor: string;
};

export const DEFAULT_WIN_LEVELS: WinLevel[] = [
  { level: 1, min: 1, max: 3, message: "WELL PLAYED!" },
  { level: 2, min: 4, max: 6, message: "NICE SCORE!" },
  { level: 3, min: 7, max: 9, message: "GREAT MEMORY!" },
  { level: 4, min: 10, max: 13, message: "EXCELLENT!" },
  { level: 5, min: 14, max: 17, message: "INCREDIBLE!" },
  { level: 6, min: 18, max: 18, message: "BRAVO, PERFECT SCORE!" },
];

export const DEFAULT_CONFIG: GameConfig = {
  title: "MEMORY",
  titleAccent: "GAME",
  instruction:
    "FIND AS MANY PRODUCT PAIRS AS POSSIBLE BEFORE TIME RUNS OUT!",
  heroProductName: "IT'S A STRETCH",
  durationSeconds: 60,
  gridRows: 6,
  gridCols: 6,
  totalPairs: 18,
  flipBackDelayMs: 850,
  trackWrongAttempts: true,
  winLevels: DEFAULT_WIN_LEVELS,
  brandColor: "#ed6f7e",
};

const KEY = "sephora-game-config-v5";

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
        Array.isArray(parsed.winLevels) && parsed.winLevels.length === 6
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
  if (levels.length !== 6) return "Il doit y avoir exactement 6 niveaux.";
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    if (lv.min < 1) return `Niveau ${i + 1} : minimum ≥ 1.`;
    if (lv.max < lv.min) return `Niveau ${i + 1} : max ≥ min.`;
    if (i > 0 && lv.min <= levels[i - 1].max)
      return `Niveau ${i + 1} : doit commencer après le précédent.`;
  }
  if (levels[5].max > 18) return "Niveau 6 : max ≤ 18.";
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

export type CompletedReason = "TIMEOUT" | "PERFECT_SCORE" | "MANUAL_RESTART";

export type GameSession = {
  id: string;
  pairsFound: number;
  totalPairs: number;
  wrongAttempts: number;
  finalWinLevel: number | null;
  durationSeconds: number;
  completedReason: CompletedReason;
  createdAt: number;
};

const SESS_KEY = "sephora-game-sessions-v2";

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
