import { loadConfig, type GameConfig } from "@/lib/game-config";

export type KioskSize = "sm" | "lg";

export type KioskLaunch = {
  kiosk: boolean;
  size: KioskSize | null;
};

/** Parse launch params from a location search string (with or without `?`). */
export function parseKioskSearch(search: string): KioskLaunch {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const kioskRaw = params.get("kiosk");
  const kiosk =
    kioskRaw === "true" || kioskRaw === "1" || kioskRaw === "";
  const sizeRaw = params.get("size");
  const size: KioskSize | null =
    sizeRaw === "sm" || sizeRaw === "lg" ? sizeRaw : null;
  return { kiosk, size };
}

/** Prefer an explicit search string (SSR-safe via router); fall back to window. */
export function getKioskLaunch(search?: string): KioskLaunch {
  if (typeof search === "string") return parseKioskSearch(search);
  if (typeof window === "undefined") return { kiosk: false, size: null };
  return parseKioskSearch(window.location.search);
}

/**
 * Defaults ← localStorage admin overrides ← kiosk URL forces autoPrintEnabled.
 * Pass router `location.searchStr` so SSR sees `?kiosk=true`.
 * Does not write URL overlays into localStorage.
 */
export function resolveConfig(search?: string): GameConfig {
  const cfg = loadConfig();
  const { kiosk } = getKioskLaunch(search);
  if (!kiosk) return cfg;
  return { ...cfg, autoPrintEnabled: true };
}

/** Current `?kiosk=&size=` (only recognised keys), or empty string. */
export function launchSearch(search?: string): string {
  const { kiosk, size } = getKioskLaunch(search);
  const params = new URLSearchParams();
  if (kiosk) params.set("kiosk", "true");
  if (size) params.set("size", size);
  const q = params.toString();
  return q ? `?${q}` : "";
}

/** Append preserved launch search to a path (path may already include `?`). */
export function withLaunchSearch(path: string, search?: string): string {
  const q = launchSearch(search);
  if (!q) return path;
  if (path.includes("?")) {
    const [base, existing] = path.split("?", 2);
    const merged = new URLSearchParams(existing);
    const launch = new URLSearchParams(q.slice(1));
    launch.forEach((v, k) => merged.set(k, v));
    const out = merged.toString();
    return out ? `${base}?${out}` : base;
  }
  return `${path}${q}`;
}
