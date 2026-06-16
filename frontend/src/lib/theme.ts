// Dark Mode P1 — theme resolution + persistence (framework-free so the
// index.html boot script and the React layer share ONE contract). The pref is
// the user's choice (light | dark | system); the RESOLVED theme written to
// <html data-theme> is only ever light | dark. tokens.css keys its dark block
// off `[data-theme="dark"]`, so flipping the dataset attribute flips the palette.

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** localStorage key — MUST match the inline boot script in index.html. */
export const THEME_STORAGE_KEY = "hws-theme";

const VALID_PREFS: readonly ThemePref[] = ["light", "dark", "system"];

/** True when the OS reports a dark color-scheme preference. SSR/JSDOM-safe. */
export function prefersDark(): boolean {
  return (
    typeof globalThis.window !== "undefined" &&
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Collapse a pref to the concrete theme; `system` consults `prefers-color-scheme`. */
export function resolveTheme(pref: ThemePref): ResolvedTheme {
  if (pref === "system") return prefersDark() ? "dark" : "light";
  return pref;
}

/** Write the resolved theme to <html data-theme> and return it. */
export function applyTheme(pref: ThemePref): ResolvedTheme {
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

/** Read the persisted pref; defaults to `system`. Tolerates blocked storage. */
export function readStoredPref(): ThemePref {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && (VALID_PREFS as readonly string[]).includes(raw)) {
      return raw as ThemePref;
    }
  } catch {
    // localStorage blocked (private mode / sandbox) — fall through to default.
  }
  return "system";
}

/** Persist the pref. Swallows quota / privacy-mode failures. */
export function writeStoredPref(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Persistence is best-effort; the in-memory pref still drives this session.
  }
}
