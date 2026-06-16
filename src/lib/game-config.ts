export type GameConfig = {
  title: string;
  titleAccent: string;
  instruction: string;
  targetProductName: string;
  targetsRequired: number;
  attemptsAllowed: number;
  durationSeconds: number;
  gridCols: number;
  gridRows: number;
};

export const DEFAULT_CONFIG: GameConfig = {
  title: "MEMORY",
  titleAccent: "GAME",
  instruction: "RETROUVEZ 2 MASCARAS IT'S A STRETCH EN 3 ESSAIS !",
  targetProductName: "IT'S A STRETCH",
  targetsRequired: 2,
  attemptsAllowed: 3,
  durationSeconds: 10,
  gridCols: 4,
  gridRows: 5,
};

const KEY = "sephora-game-config";

export function loadConfig(): GameConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(c: GameConfig) {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export type SessionResult = "WIN" | "LOSS" | "TIMEOUT";
export type GameSession = {
  id: string;
  result: SessionResult;
  targetsFound: number;
  attemptsUsed: number;
  durationSeconds: number;
  createdAt: number;
};

const SESS_KEY = "sephora-game-sessions";

export function loadSessions(): GameSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SESS_KEY) ?? "[]");
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
