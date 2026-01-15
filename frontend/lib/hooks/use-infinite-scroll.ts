import { useState, useEffect, useCallback, useRef } from "react";

export interface InfiniteScrollOptions<T> {
  /**
   * Function to fetch a page of data
   * Should return items array and total count
   */
  fetchFunction: (page: number) => Promise<{ items: T[]; total: number; page: number; total_pages: number }>;

  /**
   * Number of items per page (default: 50)
   */
  pageSize?: number;

  /**
   * Dependencies that should trigger a reset when changed
   * e.g., search query, filters, sort order
   */
  dependencies?: any[];

  /**
   * Whether to automatically fetch the first page on mount
   * (default: true)
   */
  autoFetch?: boolean;
}

export interface UseInfiniteScrollReturn<T> {
  /** Accumulated items from all loaded pages */
  items: T[];

  /** Current page number */
  currentPage: number;

  /** Total number of items across all pages */
  totalItems: number;

  /** Whether there are more pages to load */
  hasMore: boolean;

  /** Initial loading state (first page) */
  isLoading: boolean;

  /** Loading more pages state */
  isLoadingMore: boolean;

  /** Error message if fetch failed */
  error: string | null;

  /** Load the next page */
  loadMore: () => Promise<void>;

  /** Reset to first page and clear all items */
  reset: () => void;

  /** Manually refetch current pages */
  refetch: () => Promise<void>;
}

/**
 * Hook for infinite scroll pagination
 *
 * Fetches pages from the backend as the user scrolls down.
 * Accumulates all fetched items in memory.
 *
 * @example
 * ```tsx
 * const {
 *   items,
 *   hasMore,
 *   loadMore,
 *   isLoading,
 *   isLoadingMore,
 * } = useInfiniteScroll({
 *   fetchFunction: async (page) => await itemsApi.list({ page, limit: 50 }),
 *   pageSize: 50,
 *   dependencies: [searchQuery, categoryFilter],
 * });
 * ```
 */
export function useInfiniteScroll<T>({
  fetchFunction,
  pageSize = 50,
  dependencies = [],
  autoFetch = true,
}: InfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track if we're currently fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);

  // Use ref to track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch a specific page
   */
  const fetchPage = useCallback(
    async (page: number, append: boolean = true) => {
      // Prevent duplicate fetches
      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;

      if (page === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      setError(null);

      try {
        const response = await fetchFunction(page);

        // Only update state if still mounted
        if (!isMountedRef.current) {
          return;
        }

        if (append) {
          setItems((prev) => [...prev, ...response.items]);
        } else {
          setItems(response.items);
        }

        setTotalItems(response.total);
        setCurrentPage(page);

        // Check if there are more pages
        const hasMorePages = page < response.total_pages;
        setHasMore(hasMorePages);
      } catch (err) {
        if (isMountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : "Failed to load data";
          setError(errorMessage);
          console.error("Failed to fetch page:", err);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
          isFetchingRef.current = false;
        }
      }
    },
    [fetchFunction]
  );

  /**
   * Load the next page
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingRef.current) {
      return;
    }

    await fetchPage(currentPage + 1, true);
  }, [hasMore, currentPage, fetchPage]);

  /**
   * Reset to first page
   */
  const reset = useCallback(() => {
    setItems([]);
    setCurrentPage(1);
    setTotalItems(0);
    setHasMore(true);
    setError(null);

    // Fetch first page
    if (autoFetch) {
      fetchPage(1, false);
    }
  }, [autoFetch, fetchPage]);

  /**
   * Refetch all currently loaded pages
   */
  const refetch = useCallback(async () => {
    const pagesToFetch = currentPage;
    setItems([]);

    // Fetch all pages sequentially
    for (let page = 1; page <= pagesToFetch; page++) {
      await fetchPage(page, true);
    }
  }, [currentPage, fetchPage]);

  // Auto-fetch first page on mount
  useEffect(() => {
    if (autoFetch) {
      fetchPage(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  // Reset when dependencies change
  useEffect(() => {
    if (dependencies.length > 0) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return {
    items,
    currentPage,
    totalItems,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    reset,
    refetch,
  };
}
