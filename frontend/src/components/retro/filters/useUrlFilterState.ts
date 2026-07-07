import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  type FilterChip,
  type FilterDef,
  type FilterValues,
  chipsForDefs,
  readFilterValues,
} from "./filterDefs";

export interface UseUrlFilterStateOptions {
  /** Search param that `clearAll` also wipes (the free-text box). Default "q". */
  searchKey?: string;
  /** Localized "Yes" for boolean chips. Default "Yes". */
  yesLabel?: string;
}

export interface FilterState {
  values: FilterValues;
  /** Committed search terms (`?terms=a,b`), order-preserving + deduped. Part of
   *  saved views; the LIVE search box (`q`) is not. */
  terms: string[];
  /** Write one def's values (empty → delete the param); always resets page=1. */
  set: (key: string, next: string[]) => void;
  /** Clear a single def (chip ✕). */
  clear: (key: string) => void;
  /** Pin a live search term as a committed `SEARCH:` token (trim + dedupe). */
  commitTerm: (term: string) => void;
  /** Remove one committed term (token ✕). */
  removeTerm: (term: string) => void;
  /** Wipe the search box + every def param + terms; keeps sort; resets page=1. */
  clearAll: () => void;
  /** Human-readable active-filter chips (the search term is NOT chipped). */
  chips: FilterChip[];
  /** True when any def has a value OR any term is committed. */
  hasActive: boolean;
}

/** The reserved URL param for committed search terms. */
export const TERMS_KEY = "terms";

/** Decode `?terms=a,b` into an order-preserving, deduped string[]. Pure. */
export function readTerms(params: URLSearchParams): string[] {
  const raw = params.get(TERMS_KEY);
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw.split(",")) {
    const term = t.trim();
    if (term && !seen.has(term)) {
      seen.add(term);
      out.push(term);
    }
  }
  return out;
}

/**
 * URL-backed adapter for the generic filter model. One param per def
 * (`?category=<id>&insured=1`) so existing saved-view snapshots — which
 * capture every URL param except `page` — keep working with zero changes.
 *
 * `defs` MUST be memoized by the caller (its identity gates the value/chip
 * memos here).
 */
export function useUrlFilterState(
  defs: FilterDef[],
  options: UseUrlFilterStateOptions = {},
): FilterState {
  const { searchKey = "q", yesLabel = "Yes" } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(
    () => readFilterValues(defs, searchParams),
    [defs, searchParams],
  );
  const terms = useMemo(() => readTerms(searchParams), [searchParams]);

  const writeTerms = useCallback(
    (next: string[]) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (next.length === 0) p.delete(TERMS_KEY);
        else p.set(TERMS_KEY, next.join(","));
        p.set("page", "1");
        return p;
      });
    },
    [setSearchParams],
  );

  // Pin a term AND consume the live search box in ONE URL write — doing the two
  // as separate setSearchParams calls races (each reads the same pre-event
  // snapshot, so the second clobbers the first).
  const commitTerm = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete(searchKey);
        const next = terms.includes(trimmed) ? terms : [...terms, trimmed];
        p.set(TERMS_KEY, next.join(","));
        p.set("page", "1");
        return p;
      });
    },
    [terms, setSearchParams, searchKey],
  );

  const removeTerm = useCallback(
    (term: string) => writeTerms(terms.filter((t) => t !== term)),
    [terms, writeTerms],
  );

  const set = useCallback(
    (key: string, next: string[]) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (next.length === 0) p.delete(key);
        else p.set(key, next.join(","));
        p.set("page", "1");
        return p;
      });
    },
    [setSearchParams],
  );

  const clear = useCallback((key: string) => set(key, []), [set]);

  const clearAll = useCallback(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete(searchKey);
      p.delete(TERMS_KEY);
      for (const def of defs) p.delete(def.key);
      p.set("page", "1");
      return p;
    });
  }, [setSearchParams, defs, searchKey]);

  const chips = useMemo(
    () => chipsForDefs(defs, values, yesLabel),
    [defs, values, yesLabel],
  );
  const hasActive = useMemo(
    () => terms.length > 0 || Object.values(values).some((v) => v.length > 0),
    [values, terms],
  );

  return {
    values,
    terms,
    set,
    clear,
    commitTerm,
    removeTerm,
    clearAll,
    chips,
    hasActive,
  };
}
