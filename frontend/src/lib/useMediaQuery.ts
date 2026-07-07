import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query. Re-renders on match changes (viewport resize,
 * orientation). SSR / first paint assumes NO match (desktop-first — the mobile
 * branch mounts only once the client confirms it). Uses matchMedia, the same
 * primitive the theme layer already relies on.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
