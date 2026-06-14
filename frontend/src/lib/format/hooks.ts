import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import {
  DEFAULT_FORMAT_TOKENS,
  formatDateToken,
  formatTimeToken,
  formatNumberToken,
} from "./tokens";

// Phase 15 Plan 01 — I18N-03 render-loop-safe format hooks. Each reads the SHARED
// ["me"] query (settingsApi.getMe — already cached app-wide; no new fetch path),
// derives the relevant token PRIMITIVE(s), and returns a `useMemo`-stable formatter.
//
// RENDER-LOOP GUARD (the recurring 4× bug): the useMemo deps are the derived token
// STRINGS only — NEVER `me.data` object identity and NEVER a fresh object literal in
// the deps array. When the tokens are unchanged the returned function keeps a stable
// reference across renders, so a consuming component memoized on the formatter does
// not thrash. Tokens fall back to DEFAULT_FORMAT_TOKENS while ["me"] is
// pending/absent.

/** Returns a stable `(iso) => string` bound to the user's `date_format` token. */
export function useDateFormat(): (iso: string) => string {
  const me = useQuery({ queryKey: ["me"], queryFn: () => settingsApi.getMe() });
  const token = me.data?.date_format ?? DEFAULT_FORMAT_TOKENS.date_format;
  return useMemo(() => (iso: string) => formatDateToken(iso, token), [token]);
}

/** Returns a stable `(iso) => string` bound to the user's `time_format` token. */
export function useTimeFormat(): (iso: string) => string {
  const me = useQuery({ queryKey: ["me"], queryFn: () => settingsApi.getMe() });
  const token = me.data?.time_format ?? DEFAULT_FORMAT_TOKENS.time_format;
  return useMemo(() => (iso: string) => formatTimeToken(iso, token), [token]);
}

/** Returns a stable `(n) => string` bound to the user's separator tokens. */
export function useNumberFormat(): (n: number) => string {
  const me = useQuery({ queryKey: ["me"], queryFn: () => settingsApi.getMe() });
  const thousand =
    me.data?.thousand_separator ?? DEFAULT_FORMAT_TOKENS.thousand_separator;
  const decimal =
    me.data?.decimal_separator ?? DEFAULT_FORMAT_TOKENS.decimal_separator;
  return useMemo(
    () => (n: number) => formatNumberToken(n, { thousand, decimal }),
    [thousand, decimal],
  );
}
