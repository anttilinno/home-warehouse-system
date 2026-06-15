import { useCallback, useEffect, useState } from "react";

/**
 * A saved filter preset. `filters` is the serialized FilterBar state (opaque to
 * this hook). Typed `Record<string, unknown>` — the persisted payload re-enters
 * the app from localStorage and is treated as untrusted (ASVS V5).
 */
export interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
  isDefault?: boolean;
}

export interface UseSavedFiltersOptions {
  /** Per-table localStorage key the preset array is stored under. */
  storageKey: string;
  /** Invoked with a preset's filters on applyFilter (and the default on mount). */
  onApplyFilter?: (filters: Record<string, unknown>) => void;
}

/** A persisted payload is only trusted once it is a SavedFilter[] array. */
function isSavedFilterArray(value: unknown): value is SavedFilter[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as SavedFilter).id === "string" &&
        typeof (v as SavedFilter).name === "string",
    )
  );
}

/**
 * localStorage-backed saved-filter presets (server prefs deferred to Phase 12;
 * the contract is forward-compatible — the storage shape is a SavedFilter[]
 * array under `storageKey`). The read is try/catch-wrapped: a malformed payload
 * (non-JSON) or a wrong-shape payload (valid JSON that is not a SavedFilter[])
 * resets to `[]` without throwing — the persisted blob is untrusted input.
 */
export function useSavedFilters({
  storageKey,
  onApplyFilter,
}: UseSavedFiltersOptions) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Load on mount / storageKey change. Treat the persisted blob as untrusted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: onApplyFilter omitted — re-run only on storageKey change (mount semantics); callers may pass an inline fn.
  useEffect(() => {
    let parsed: SavedFilter[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const candidate: unknown = JSON.parse(stored);
        parsed = isSavedFilterArray(candidate) ? candidate : [];
      }
    } catch {
      // Malformed (non-JSON) payload — reset to a clean slate, never throw.
      parsed = [];
    }
    setSavedFilters(parsed);

    // Auto-apply the default preset, if one is persisted.
    const defaultFilter = parsed.find((f) => f.isDefault);
    if (defaultFilter && onApplyFilter) {
      onApplyFilter(defaultFilter.filters);
    }
  }, [storageKey]);

  const persist = useCallback(
    (filters: SavedFilter[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(filters));
      } catch {
        // Quota/availability errors are non-fatal — the in-memory state stays
        // authoritative for this session.
      }
    },
    [storageKey],
  );

  const saveFilter = useCallback(
    (name: string, filters: Record<string, unknown>, isDefault = false) => {
      const newFilter: SavedFilter = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        filters,
        createdAt: new Date().toISOString(),
        isDefault,
      };
      setSavedFilters((prev) => {
        // Setting a new default clears the prior default flag.
        const base = isDefault
          ? prev.map((f) => ({ ...f, isDefault: false }))
          : prev;
        const next = [...base, newFilter];
        persist(next);
        return next;
      });
      return newFilter;
    },
    [persist],
  );

  const deleteFilter = useCallback(
    (id: string) => {
      setSavedFilters((prev) => {
        const next = prev.filter((f) => f.id !== id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const updateFilter = useCallback(
    (id: string, updates: Partial<SavedFilter>) => {
      setSavedFilters((prev) => {
        const next = prev.map((f) => {
          if (f.id === id) return { ...f, ...updates };
          // Clear the default flag on the others when a new default is set.
          if (updates.isDefault) return { ...f, isDefault: false };
          return f;
        });
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const applyFilter = useCallback(
    (id: string) => {
      const filter = savedFilters.find((f) => f.id === id);
      if (filter && onApplyFilter) onApplyFilter(filter.filters);
      return filter;
    },
    [savedFilters, onApplyFilter],
  );

  const setAsDefault = useCallback(
    (id: string) => {
      updateFilter(id, { isDefault: true });
    },
    [updateFilter],
  );

  const getDefaultFilter = useCallback(
    () => savedFilters.find((f) => f.isDefault),
    [savedFilters],
  );

  return {
    savedFilters,
    saveFilter,
    deleteFilter,
    updateFilter,
    applyFilter,
    setAsDefault,
    getDefaultFilter,
  };
}
