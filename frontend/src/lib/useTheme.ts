import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  applyTheme,
  readStoredPref,
  resolveTheme,
  writeStoredPref,
  type ResolvedTheme,
  type ThemePref,
} from "./theme";

// Dark Mode P1 — the React-side theme signal. `pref` is the user's choice;
// `resolved` is the concrete light|dark currently painted. setPref persists +
// applies. While pref is `system` a matchMedia listener re-applies live so an OS
// toggle flips the app without a reload. The PWA <meta name="theme-color"> is
// kept in sync here (P4) so the mobile status bar tracks the theme.

interface ThemeContextValue {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#fdf6ec",
  dark: "#15151b",
};

function syncThemeColorMeta(resolved: ResolvedTheme): void {
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (meta) meta.content = THEME_COLOR[resolved];
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => readStoredPref());
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(pref),
  );

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    writeStoredPref(next);
    const applied = applyTheme(next);
    setResolved(applied);
    syncThemeColorMeta(applied);
  }, []);

  // Live-follow the OS while the pref is `system` (RENDER-LOOP safe: keyed on
  // pref, runs in an effect, idempotent — applyTheme just sets a dataset attr).
  useEffect(() => {
    if (pref !== "system") return;
    const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const applied = applyTheme("system");
      setResolved(applied);
      syncThemeColorMeta(applied);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return createElement(
    ThemeContext.Provider,
    { value: { pref, resolved, setPref } },
    children,
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
