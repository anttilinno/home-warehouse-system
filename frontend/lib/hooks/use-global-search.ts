import { useState, useEffect, useCallback } from "react";
import { useDebouncedValue } from "./use-debounced-value";
import {
  globalSearch,
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  type GlobalSearchResponse,
  type SearchResult,
} from "../api/search";

export interface UseGlobalSearchOptions {
  debounceMs?: number;
  limit?: number;
  minQueryLength?: number;
}

export interface UseGlobalSearchReturn {
  // Input state
  query: string;
  setQuery: (query: string) => void;

  // Search results
  results: GlobalSearchResponse | null;
  isLoading: boolean;
  error: string | null;

  // Recent searches
  recentSearches: string[];
  selectRecentSearch: (query: string) => void;
  clearRecent: () => void;

  // Result navigation
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  allResults: SearchResult[];
  selectedResult: SearchResult | null;

  // Actions
  executeSearch: () => void;
  clearSearch: () => void;
}

export function useGlobalSearch(
  options: UseGlobalSearchOptions = {}
): UseGlobalSearchReturn {
  const {
    debounceMs = 300,
    limit = 5,
    minQueryLength = 2,
  } = options;

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

  const selectedResult = selectedIndex >= 0 && selectedIndex < allResults.length
    ? allResults[selectedIndex]
    : null;

  // Execute search
  const executeSearch = useCallback(async () => {
    const trimmedQuery = debouncedQuery.trim();

    // Reset if query is too short
    if (trimmedQuery.length < minQueryLength) {
      setResults(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedIndex(-1); // Reset selection

    try {
      const searchResults = await globalSearch(trimmedQuery, limit);
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
  }, [debouncedQuery, limit, minQueryLength]);

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
  };
}
