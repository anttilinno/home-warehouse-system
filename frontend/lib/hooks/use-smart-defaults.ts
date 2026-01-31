"use client";

import { useCallback } from "react";

const STORAGE_KEY_PREFIX = "hws-smart-defaults-";
const MAX_RECENT = 5;

interface RecentSelection {
  value: string;
  label?: string;
  usedAt: number;
}

/**
 * Hook for remembering recent field selections.
 * Stores last N selections per field in localStorage for smart defaults.
 *
 * @param fieldKey - Unique key for the field (e.g., "item-category", "location-parent")
 * @returns { getRecent, getDefault, recordSelection, clearHistory }
 */
export function useSmartDefaults(fieldKey: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${fieldKey}`;

  // Get recent selections for a field
  const getRecent = useCallback((): RecentSelection[] => {
    if (typeof localStorage === "undefined") return [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return [];
      return JSON.parse(stored) as RecentSelection[];
    } catch {
      return [];
    }
  }, [storageKey]);

  // Get the most recent selection (for default value)
  const getDefault = useCallback((): string | null => {
    const recent = getRecent();
    return recent.length > 0 ? recent[0].value : null;
  }, [getRecent]);

  // Record a selection
  const recordSelection = useCallback(
    (value: string, label?: string) => {
      if (typeof localStorage === "undefined") return;
      try {
        const recent = getRecent().filter((r) => r.value !== value);
        recent.unshift({ value, label, usedAt: Date.now() });
        const trimmed = recent.slice(0, MAX_RECENT);
        localStorage.setItem(storageKey, JSON.stringify(trimmed));
      } catch {
        // Ignore localStorage errors
      }
    },
    [storageKey, getRecent]
  );

  // Clear history for this field
  const clearHistory = useCallback(() => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  }, [storageKey]);

  return { getRecent, getDefault, recordSelection, clearHistory };
}
