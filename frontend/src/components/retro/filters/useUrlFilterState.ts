import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { FilterChip } from "./FilterBar";
import {
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
  /** Write one def's values (empty → delete the param); always resets page=1. */
  set: (key: string, next: string[]) => void;
  /** Clear a single def (chip ✕). */
  clear: (key: string) => void;
  /** Wipe the search box + every def param; keeps sort; resets page=1. */
  clearAll: () => void;
  /** Human-readable active-filter chips (the search term is NOT chipped). */
  chips: FilterChip[];
  /** True when any def has a value (the page ORs its own search term in). */
  hasActive: boolean;
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
    () => Object.values(values).some((v) => v.length > 0),
    [values],
  );

  return { values, set, clear, clearAll, chips, hasActive };
}
