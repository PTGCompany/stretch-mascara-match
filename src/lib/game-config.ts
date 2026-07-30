export type WinLevel = {
  level: number;
  min: number;
  max: number;
  label: string;
  message: string;
  gainDescription?: string;
  ticketText?: string;
  rewardProductName?: string;
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
  ticketPrintingEnabled: boolean;
  printNoRewardTicketEnabled: boolean;
  autoPrintEnabled: boolean;
  ticketFooterText: string;
  ticketBrandTitle: string;
  ticketBrandFallbackText: string;
  sephoraDeliLogoUrl: string;
};

/**
 * Reward tiers based on `pairsFound` (not raw score) so a time bonus never
 * bumps a lower pair count into a higher tier. 0 pairs = no-reward and is
 * handled at render time, not as a tier.
 */
export const DEFAULT_WIN_LEVELS: WinLevel[] = [
  {
    level: 1,
    min: 1,
    max: 3,
    label: "REWARD LEVEL 1",
    message: "WELL PLAYED!",
    gainDescription: "Discovery sample",
    ticketText: "Reward Level 1 — Gift 1",
    rewardProductName: "Gift 1",
  },
  {
    level: 2,
    min: 4,
    max: 7,
    label: "REWARD LEVEL 2",
    message: "GREAT SCORE!",
    gainDescription: "Mini format gift",
    ticketText: "Reward Level 2 — Gift 2",
    rewardProductName: "Gift 2",
  },
  {
    level: 3,
    min: 8,
    max: 10,
    label: "REWARD LEVEL 3",
    message: "EXCELLENT MEMORY!",
    gainDescription: "Signature gift set",
    ticketText: "Reward Level 3 — Gift 3",
    rewardProductName: "Gift 3",
  },
];

export const DEFAULT_CONFIG: GameConfig = {
  title: "MEMORY",
  titleAccent: "GAME",
  instruction: "FIND AS MANY PAIRS AS YOU CAN IN 30 SECONDS!",
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
  ticketPrintingEnabled: true,
  printNoRewardTicketEnabled: false,
  // Default off for Lovable/web preview. Hardware kiosk forces on via ?kiosk=true
  // (see kiosk-launch resolveConfig). Admin can also enable for lab testing.
  autoPrintEnabled: false,
  ticketFooterText: "PICK UP YOUR ORDER!",
  ticketBrandTitle: "SEPHORA DELI",
  ticketBrandFallbackText: "SEPHORA DELI",
  sephoraDeliLogoUrl: "/__l5e/assets-v1/72bf6f6a-492a-4d63-9dde-a4c41a951b75/sephora-deli-stacked.png",
};

const KEY = "sephora-game-config-v15";


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
        Array.isArray(parsed.winLevels) && parsed.winLevels.length === 3
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
  if (levels.length !== 3) return "There must be exactly 3 reward tiers.";
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    if (lv.min < 1 || lv.min > 10) return `Tier ${i + 1}: min must be between 1 and 10.`;
    if (lv.max < lv.min || lv.max > 10) return `Tier ${i + 1}: max must be between min and 10.`;
    if (i > 0 && lv.min <= levels[i - 1].max)
      return `Tier ${i + 1}: must start after the previous tier.`;
  }
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
export type PrintStatus = "NOT_REQUESTED" | "REQUESTED" | "PRINTED" | "FAILED";

export type GameSession = {
  id: string;
  pairsFound: number;
  totalPairs: number;
  wrongAttempts: number;
  finalWinLevel: number | null;
  rewardTierLabel: string | null;
  rewardTierMessage: string | null;
  rewardProductName: string | null;
  score: number;
  timeRemaining: number;
  durationSeconds: number;
  ticketCode: string;
  printStatus: PrintStatus;
  completedReason: CompletedReason;
  createdAt: number;
};

const SESS_KEY = "sephora-game-sessions-v4";

export function loadSessions(): GameSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SESS_KEY) ?? "[]") as GameSession[];
  } catch {
    return [];
  }
}

export function findSession(id: string): GameSession | null {
  return loadSessions().find((s) => s.id === id) ?? null;
}

export function saveSession(s: GameSession) {
  const all = loadSessions();
  all.unshift(s);
  localStorage.setItem(SESS_KEY, JSON.stringify(all.slice(0, 500)));
}

export function updateSessionPrintStatus(id: string, printStatus: PrintStatus) {
  const all = loadSessions();
  const next = all.map((s) => (s.id === id ? { ...s, printStatus } : s));
  localStorage.setItem(SESS_KEY, JSON.stringify(next));
}

export function clearSessions() {
  localStorage.removeItem(SESS_KEY);
}

export function generateTicketCode(): string {
  const r =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(2)))
          .map((n) => n.toString(36).padStart(2, "0"))
          .join("")
          .slice(0, 4)
          .toUpperCase()
      : Math.random().toString(36).slice(2, 6).toUpperCase();
  const t = Date.now().toString(36).slice(-4).toUpperCase();
  return `SC-${t}${r}`;
}
