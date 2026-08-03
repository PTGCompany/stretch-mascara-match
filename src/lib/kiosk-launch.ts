/**
 * In-store hardware kiosk launch helpers (?kiosk=true&size=sm|lg).
 *
 * Owned by Sitech Industries — not Lovable product UI. Do not remove or
 * “simplify” away: venue Chromium opens with these query params. Size presets
 * are reserved (sm|lg parsed only; gameplay presets TBD). If navigation stops
 * preserving `kiosk`/`size` on the query string, tell Sitech Industries.
 */
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

/**
 * Prefer router `location.searchStr` (SSR-safe). Reading only `window` on the
 * server always yields kiosk=false and caused the admin cog to stay visible.
 */
export function getKioskLaunch(search?: string): KioskLaunch {
  if (typeof search === "string") return parseKioskSearch(search);
  if (typeof window === "undefined") return { kiosk: false, size: null };
  return parseKioskSearch(window.location.search);
}

/**
 * Defaults ← localStorage (admin) ← if ?kiosk=true, force autoPrintEnabled.
 * Session-only overlay — do not persist URL overrides into localStorage.
 */
export function resolveConfig(search?: string): GameConfig {
  const cfg = loadConfig();
  const { kiosk } = getKioskLaunch(search);
  if (!kiosk) return cfg;
  return { ...cfg, autoPrintEnabled: true };
}

/** Rebuild `?kiosk=&size=` from the launch parse (recognised keys only). */
export function launchSearch(search?: string): string {
  const { kiosk, size } = getKioskLaunch(search);
  const params = new URLSearchParams();
  if (kiosk) params.set("kiosk", "true");
  if (size) params.set("size", size);
  const q = params.toString();
  return q ? `?${q}` : "";
}

/**
 * Keep kiosk/size on navigations (game → print → idle). Dropping search exits
 * kiosk mode on the next page.
 */
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
