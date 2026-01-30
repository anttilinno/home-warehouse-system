"use client";

/**
 * useGlobalSearch Hook
 *
 * Provides unified search experience with automatic online/offline mode switching.
 * When online, uses the API for search. When offline or forceOffline is true,
 * uses Fuse.js indices against IndexedDB data.
 *
 * Features:
 * - SRCH-01: Instant results within 300ms (debounced)
 * - SRCH-02: Fuzzy matching via Fuse.js (offline mode)
 * - SRCH-03: Autocomplete suggestions (5-8 items per type)
 * - SRCH-04: Recent searches (5 most recent shown on focus)
 * - SRCH-06: Offline search capability
 *
 * @see frontend/lib/hooks/use-offline-search.ts for index management
 * @see frontend/lib/search/offline-search.ts for offline search logic
 */

import { useState, useEffect, useCallback } from "react";
import { useDebouncedValue } from "./use-debounced-value";
import { useNetworkStatus } from "./use-network-status";
import { useOfflineSearch } from "./use-offline-search";
import {
  globalSearch,
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  type GlobalSearchResponse,
  type SearchResult,
} from "../api/search";

/**
 * Options for useGlobalSearch hook
 */
export interface UseGlobalSearchOptions {
  /** Workspace ID for scoping search */
  workspaceId: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Max results per entity type (default: 5) */
  limit?: number;
  /** Minimum query length to trigger search (default: 2) */
  minQueryLength?: number;
  /** Force offline mode for testing (default: false) */
  forceOffline?: boolean;
}

/**
 * Return type for useGlobalSearch hook
 */
export interface UseGlobalSearchReturn {
  // Input state
  /** Current search query */
  query: string;
  /** Set search query */
  setQuery: (query: string) => void;

  // Search results
  /** Search results or null if no search performed */
  results: GlobalSearchResponse | null;
  /** Whether search is in progress */
  isLoading: boolean;
  /** Error message if search failed */
  error: string | null;

  // Recent searches
  /** Recent search queries (5 most recent) */
  recentSearches: string[];
  /** Select a recent search query */
  selectRecentSearch: (query: string) => void;
  /** Clear all recent searches */
  clearRecent: () => void;

  // Result navigation
  /** Selected result index for keyboard navigation */
  selectedIndex: number;
  /** Set selected result index */
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  /** Flattened array of all results for keyboard navigation */
  allResults: SearchResult[];
  /** Currently selected result or null */
  selectedResult: SearchResult | null;

  // Actions
  /** Manually trigger search execution */
  executeSearch: () => void;
  /** Clear search query and results */
  clearSearch: () => void;

  // Offline status
  /** Whether currently searching in offline mode */
  isOffline: boolean;
  /** Whether offline search indices are ready */
  isOfflineReady: boolean;
}

/**
 * Global search hook with automatic online/offline mode switching.
 *
 * @param options - Search configuration options
 * @returns UseGlobalSearchReturn with search state and actions
 */
export function useGlobalSearch(
  options: UseGlobalSearchOptions
): UseGlobalSearchReturn {
  const {
    workspaceId,
    debounceMs = 300,
    limit = 5,
    minQueryLength = 2,
    forceOffline = false,
  } = options;

  // Network status for automatic mode switching
  const { isOnline } = useNetworkStatus();

  // Offline search indices
  const offlineSearch = useOfflineSearch();

  // Determine if we should use offline mode
  const shouldUseOffline = !isOnline || forceOffline;

  // Search query state
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  // Search results state
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recent searches
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Flatten results for keyboard navigation
  const allResults: SearchResult[] = results
    ? [
        ...results.results.items,
        ...results.results.borrowers,
        ...results.results.containers,
        ...results.results.locations,
      ]
    : [];

  const selectedResult =
    selectedIndex >= 0 && selectedIndex < allResults.length
      ? allResults[selectedIndex]
      : null;

  // Execute search (online or offline based on network status)
  const executeSearch = useCallback(async () => {
    const trimmedQuery = debouncedQuery.trim();

    // Reset if query is too short or no workspace
    if (!workspaceId || trimmedQuery.length < minQueryLength) {
      setResults(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedIndex(-1); // Reset selection

    try {
      let searchResults: GlobalSearchResponse;

      if (shouldUseOffline) {
        // Offline mode - use Fuse.js indices
        if (!offlineSearch.isReady) {
          // Indices not ready yet, keep loading state
          return;
        }

        const offlineResults = await offlineSearch.search(trimmedQuery, limit);
        if (!offlineResults) {
          throw new Error("Offline search unavailable");
        }
        searchResults = offlineResults;
      } else {
        // Online mode - use API
        searchResults = await globalSearch(workspaceId, trimmedQuery, limit);
      }

      setResults(searchResults);

      // Add to recent searches if results found
      if (searchResults.totalCount > 0) {
        addRecentSearch(trimmedQuery);
        setRecentSearches(getRecentSearches());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    workspaceId,
    debouncedQuery,
    limit,
    minQueryLength,
    shouldUseOffline,
    offlineSearch,
  ]);

  // Execute search when debounced query changes
  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  // Select a recent search
  const selectRecentSearch = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
  }, []);

  // Clear recent searches
  const clearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery("");
    setResults(null);
    setError(null);
    setSelectedIndex(-1);
  }, []);

  return {
    // Input state
    query,
    setQuery,

    // Search results
    results,
    isLoading,
    error,

    // Recent searches
    recentSearches,
    selectRecentSearch,
    clearRecent,

    // Result navigation
    selectedIndex,
    setSelectedIndex,
    allResults,
    selectedResult,

    // Actions
    executeSearch,
    clearSearch,

    // Offline status
    isOffline: shouldUseOffline,
    isOfflineReady: offlineSearch.isReady,
  };
}
