import { useCallback, useEffect, useState } from "react";

/**
 * Two-way bind a tab identifier to the URL hash fragment.
 *
 * - Reads initial tab from `window.location.hash` (SSR-safe).
 * - Validates against the caller's `valid` allowlist — invalid hashes
 *   fall back to `defaultTab`, so user-controlled hash values cannot
 *   inject arbitrary tab ids.
 * - Subscribes to `hashchange` so back/forward navigation updates state.
 * - Writing uses `history.replaceState` to avoid polluting history.
 */
export function useHashTab<T extends string>(
  defaultTab: T,
  valid: readonly T[],
): [T, (k: T) => void] {
  const read = useCallback((): T => {
    if (typeof window === "undefined") return defaultTab;
    const h = window.location.hash.slice(1) as T;
    return (valid as readonly string[]).includes(h) ? h : defaultTab;
  }, [defaultTab, valid]);

  const [tab, setTab] = useState<T>(read);

  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [read]);

  const change = useCallback(
    (k: T) => {
      if (!(valid as readonly string[]).includes(k)) return;
      window.history.replaceState(null, "", `#${k}`);
      setTab(k);
    },
    [valid],
  );

  return [tab, change];
}
