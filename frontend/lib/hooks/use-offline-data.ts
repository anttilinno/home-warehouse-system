"use client";

/**
 * useOfflineData Hook
 *
 * Implements stale-while-revalidate pattern for offline-first data access.
 * Returns cached data immediately, fetches fresh data in background,
 * and falls back to cached data when offline.
 */

import { useState, useEffect, useCallback } from "react";
import { getAll, putAll, clearStore } from "@/lib/db/offline-db";

/**
 * Entity stores that support offline data (excludes syncMeta)
 */
type EntityStore =
  | "items"
  | "inventory"
  | "locations"
  | "containers"
  | "categories"
  | "borrowers"
  | "loans";

/**
 * Options for the useOfflineData hook
 */
interface UseOfflineDataOptions<T> {
  /** IndexedDB store to read from/write to */
  store: EntityStore;
  /** Function to fetch fresh data from the API */
  fetchFn: () => Promise<T[]>;
  /** Whether to enable fetching (e.g., wait for workspaceId) */
  enabled?: boolean;
}

/**
 * Result of the useOfflineData hook
 */
interface UseOfflineDataResult<T> {
  /** The data array (cached or fresh) */
  data: T[];
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** True when showing cached data while fetching fresh data */
  isStale: boolean;
  /** Error from the most recent fetch attempt */
  error: Error | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
}

/**
 * Hook for reading data with offline fallback using stale-while-revalidate pattern.
 *
 * 1. Returns cached data immediately (stale)
 * 2. Fetches fresh data in background (revalidate)
 * 3. Updates state when fresh data arrives
 * 4. Falls back to cached data if fetch fails (offline resilience)
 *
 * @example
 * ```typescript
 * const { data: items, isLoading, isStale } = useOfflineData({
 *   store: 'items',
 *   fetchFn: () => itemsApi.list(workspaceId, { limit: 10000 }).then(r => r.items),
 *   enabled: !!workspaceId,
 * });
 * ```
 */
export function useOfflineData<T extends { id: string }>({
  store,
  fetchFn,
  enabled = true,
}: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadCachedData = useCallback(async () => {
    try {
      const cached = await getAll<T>(store);
      if (cached.length > 0) {
        setData(cached);
        setIsStale(true); // Mark as stale until fresh data arrives
      }
    } catch (err) {
      console.error(`[useOfflineData] Failed to load cached ${store}:`, err);
    }
  }, [store]);

  const fetchFreshData = useCallback(async () => {
    try {
      const fresh = await fetchFn();
      await clearStore(store);
      await putAll(store, fresh);
      setData(fresh);
      setIsStale(false);
      setError(null);
    } catch (err) {
      // Keep showing cached data on error
      const error = err instanceof Error ? err : new Error("Fetch failed");
      setError(error);
      console.warn(`[useOfflineData] Failed to fetch fresh ${store}, using cached data:`, error.message);
      // Don't clear stale flag - we're still showing cached data
    }
  }, [store, fetchFn]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchFreshData();
    setIsLoading(false);
  }, [fetchFreshData]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      // 1. Load cached data immediately
      await loadCachedData();

      if (cancelled) return;

      // 2. Fetch fresh data in background (only if online)
      if (typeof navigator !== "undefined" && navigator.onLine) {
        await fetchFreshData();
      }

      if (cancelled) return;
      setIsLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [enabled, loadCachedData, fetchFreshData]);

  return { data, isLoading, isStale, error, refetch };
}
