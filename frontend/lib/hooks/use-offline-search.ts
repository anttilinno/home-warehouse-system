"use client";

/**
 * useOfflineSearch Hook
 *
 * Manages Fuse.js search indices for offline search capability.
 * Builds indices from IndexedDB on mount and provides memoized
 * search function to prevent re-indexing on every render.
 *
 * Usage:
 * ```tsx
 * const { isReady, search, rebuildIndices } = useOfflineSearch();
 *
 * // Wait for indices to be ready
 * if (!isReady) return <Loading />;
 *
 * // Perform search
 * const results = await search("drill");
 *
 * // Rebuild after sync completes
 * useEffect(() => {
 *   if (syncCompleted) rebuildIndices();
 * }, [syncCompleted]);
 * ```
 *
 * @see frontend/lib/search/offline-search.ts for index building logic
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  buildSearchIndices,
  offlineGlobalSearch,
  type SearchIndices,
} from "@/lib/search/offline-search";
import type { GlobalSearchResponse } from "@/lib/api/search";

/**
 * Return type for useOfflineSearch hook
 */
export interface UseOfflineSearchReturn {
  /** Whether indices are ready for searching */
  isReady: boolean;
  /** Whether indices are currently being built */
  isBuilding: boolean;
  /** Perform offline search with current indices */
  search: (query: string, limit?: number) => Promise<GlobalSearchResponse | null>;
  /** Rebuild indices (call after sync completes) */
  rebuildIndices: () => Promise<void>;
  /** Last time indices were rebuilt (epoch timestamp) */
  lastUpdated: number | null;
}

/**
 * Hook for managing offline Fuse.js search indices.
 *
 * Addresses Pitfall 3-F from research: indices are stored in a ref
 * to prevent re-indexing on every render. The search function is
 * memoized to maintain stable reference.
 *
 * @returns UseOfflineSearchReturn with search function and status
 */
export function useOfflineSearch(): UseOfflineSearchReturn {
  const [isReady, setIsReady] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Store indices in ref to avoid re-renders and maintain stable reference
  const indicesRef = useRef<SearchIndices | null>(null);

  /**
   * Build search indices from IndexedDB.
   * Called on mount and when rebuildIndices is invoked.
   */
  const buildIndices = useCallback(async () => {
    // Prevent concurrent builds
    if (isBuilding) return;

    setIsBuilding(true);
    try {
      const indices = await buildSearchIndices();
      indicesRef.current = indices;
      setLastUpdated(indices.lastUpdated);
      setIsReady(true);
    } catch (error) {
      console.error("[useOfflineSearch] Failed to build indices:", error);
      // Keep previous indices if available, mark as ready if we have them
      if (indicesRef.current) {
        setIsReady(true);
      }
    } finally {
      setIsBuilding(false);
    }
  }, [isBuilding]);

  // Build indices on mount
  useEffect(() => {
    buildIndices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Perform offline search using current indices.
   *
   * @param query - Search query string
   * @param limit - Max results per entity type (default: 5)
   * @returns GlobalSearchResponse or null if indices not ready
   */
  const search = useCallback(
    async (query: string, limit = 5): Promise<GlobalSearchResponse | null> => {
      if (!indicesRef.current) {
        return null;
      }
      return offlineGlobalSearch(indicesRef.current, query, limit);
    },
    []
  );

  /**
   * Rebuild indices from IndexedDB.
   * Call this after sync completes to include newly synced data.
   */
  const rebuildIndices = useCallback(async () => {
    await buildIndices();
  }, [buildIndices]);

  return {
    isReady,
    isBuilding,
    search,
    rebuildIndices,
    lastUpdated,
  };
}
