/**
 * Tests for useGlobalSearch hook
 *
 * Verifies:
 * - SRCH-01: Instant results (debounced search)
 * - SRCH-02: Fuzzy matching (via offline search)
 * - SRCH-04: Recent searches (5 most recent)
 * - SRCH-06: Offline search capability
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGlobalSearch } from "../use-global-search";
import * as networkStatus from "../use-network-status";
import * as offlineSearchHook from "../use-offline-search";
import * as searchApi from "@/lib/api/search";

// Mock dependencies
vi.mock("../use-network-status");
vi.mock("../use-offline-search");
vi.mock("@/lib/api/search");

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Default mock implementations
const mockOnlineStatus = {
  isOnline: true,
  isOffline: false,
  wasOffline: false,
};

const mockOfflineSearchReturn = {
  isReady: true,
  isBuilding: false,
  search: vi.fn(),
  rebuildIndices: vi.fn(),
  lastUpdated: Date.now(),
};

const mockOnlineResults = {
  query: "test",
  results: {
    items: [
      {
        id: "item-1",
        type: "item" as const,
        title: "Test Item",
        subtitle: "SKU001",
        url: "/dashboard/inventory?selected=item-1",
        icon: "Package",
        metadata: { sku: "SKU001" },
      },
    ],
    borrowers: [],
    containers: [],
    locations: [],
  },
  totalCount: 1,
};

const mockOfflineResults = {
  query: "test",
  results: {
    items: [
      {
        id: "offline-item-1",
        type: "item" as const,
        title: "Offline Item",
        subtitle: "OFF001",
        url: "/dashboard/inventory?selected=offline-item-1",
        icon: "Package",
        metadata: { sku: "OFF001" },
      },
    ],
    borrowers: [],
    containers: [],
    locations: [],
  },
  totalCount: 1,
};

describe("useGlobalSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Setup default mocks
    vi.mocked(networkStatus.useNetworkStatus).mockReturnValue(mockOnlineStatus);
    vi.mocked(offlineSearchHook.useOfflineSearch).mockReturnValue({
      ...mockOfflineSearchReturn,
      search: vi.fn().mockResolvedValue(mockOfflineResults),
    });
    vi.mocked(searchApi.globalSearch).mockResolvedValue(mockOnlineResults);
    vi.mocked(searchApi.getRecentSearches).mockReturnValue([]);
    vi.mocked(searchApi.addRecentSearch).mockImplementation(() => {});
    vi.mocked(searchApi.clearRecentSearches).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Offline status flags", () => {
    it("shows isOffline: false when online", () => {
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue(
        mockOnlineStatus
      );

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      expect(result.current.isOffline).toBe(false);
    });

    it("shows isOffline: true when network is offline", () => {
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue({
        isOnline: false,
        isOffline: true,
        wasOffline: false,
      });

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      expect(result.current.isOffline).toBe(true);
    });

    it("shows isOffline: true when forceOffline is set", () => {
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue(
        mockOnlineStatus
      );

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", forceOffline: true })
      );

      expect(result.current.isOffline).toBe(true);
    });

    it("shows isOfflineReady from useOfflineSearch", () => {
      vi.mocked(offlineSearchHook.useOfflineSearch).mockReturnValue({
        ...mockOfflineSearchReturn,
        isReady: false,
      });

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      expect(result.current.isOfflineReady).toBe(false);
    });
  });

  describe("Mode switching", () => {
    it("switches from online to offline when network changes", () => {
      // Start online
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue(
        mockOnlineStatus
      );

      const { result, rerender } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      expect(result.current.isOffline).toBe(false);

      // Network goes offline
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue({
        isOnline: false,
        isOffline: true,
        wasOffline: false,
      });

      rerender();

      expect(result.current.isOffline).toBe(true);
    });

    it("switches from offline to online when network returns", () => {
      // Start offline
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue({
        isOnline: false,
        isOffline: true,
        wasOffline: false,
      });

      const { result, rerender } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      expect(result.current.isOffline).toBe(true);

      // Network comes back online
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue({
        isOnline: true,
        isOffline: false,
        wasOffline: true,
      });

      rerender();

      expect(result.current.isOffline).toBe(false);
    });
  });

  describe("Recent searches (SRCH-04)", () => {
    it("loads recent searches on mount", () => {
      const recentSearches = ["drill", "hammer", "screwdriver"];
      vi.mocked(searchApi.getRecentSearches).mockReturnValue(recentSearches);

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      expect(result.current.recentSearches).toEqual(recentSearches);
    });

    it("clears recent searches", () => {
      vi.mocked(searchApi.getRecentSearches).mockReturnValue([
        "drill",
        "hammer",
      ]);

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      act(() => {
        result.current.clearRecent();
      });

      expect(searchApi.clearRecentSearches).toHaveBeenCalled();
      expect(result.current.recentSearches).toEqual([]);
    });

    it("selects a recent search", () => {
      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      act(() => {
        result.current.selectRecentSearch("hammer");
      });

      expect(result.current.query).toBe("hammer");
    });
  });

  describe("Query state", () => {
    it("initializes with empty query", () => {
      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      expect(result.current.query).toBe("");
    });

    it("updates query via setQuery", () => {
      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      act(() => {
        result.current.setQuery("drill");
      });

      expect(result.current.query).toBe("drill");
    });

    it("clears query via clearSearch", () => {
      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1" })
      );

      act(() => {
        result.current.setQuery("drill");
      });

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.query).toBe("");
      expect(result.current.results).toBe(null);
      expect(result.current.error).toBe(null);
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  describe("Search execution (async)", () => {
    it("calls API when online and query is long enough", async () => {
      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0 })
      );

      act(() => {
        result.current.setQuery("test");
      });

      await waitFor(() => {
        expect(searchApi.globalSearch).toHaveBeenCalledWith("ws-1", "test", 5);
      });
    });

    it("uses offline search when network is offline", async () => {
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue({
        isOnline: false,
        isOffline: true,
        wasOffline: false,
      });

      const mockSearch = vi.fn().mockResolvedValue(mockOfflineResults);
      vi.mocked(offlineSearchHook.useOfflineSearch).mockReturnValue({
        ...mockOfflineSearchReturn,
        search: mockSearch,
      });

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0 })
      );

      act(() => {
        result.current.setQuery("test");
      });

      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledWith("test", 5);
        expect(searchApi.globalSearch).not.toHaveBeenCalled();
      });
    });

    it("uses offline search when forceOffline is true", async () => {
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue(
        mockOnlineStatus
      );

      const mockSearch = vi.fn().mockResolvedValue(mockOfflineResults);
      vi.mocked(offlineSearchHook.useOfflineSearch).mockReturnValue({
        ...mockOfflineSearchReturn,
        search: mockSearch,
      });

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0, forceOffline: true })
      );

      act(() => {
        result.current.setQuery("test");
      });

      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalled();
        expect(searchApi.globalSearch).not.toHaveBeenCalled();
      });
    });

    it("does not search when query is too short", async () => {
      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0, minQueryLength: 3 })
      );

      act(() => {
        result.current.setQuery("te");
      });

      // Give it time to potentially call
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(searchApi.globalSearch).not.toHaveBeenCalled();
    });

    it("returns results from API", async () => {
      vi.mocked(searchApi.globalSearch).mockResolvedValue(mockOnlineResults);

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0 })
      );

      act(() => {
        result.current.setQuery("test");
      });

      await waitFor(() => {
        expect(result.current.results).toEqual(mockOnlineResults);
      });
    });

    it("adds to recent searches when results found", async () => {
      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0 })
      );

      act(() => {
        result.current.setQuery("drill");
      });

      await waitFor(() => {
        expect(searchApi.addRecentSearch).toHaveBeenCalledWith("drill");
      });
    });

    it("does not add to recent searches when no results", async () => {
      vi.mocked(searchApi.globalSearch).mockResolvedValue({
        query: "xyz",
        results: { items: [], borrowers: [], containers: [], locations: [] },
        totalCount: 0,
      });

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0 })
      );

      act(() => {
        result.current.setQuery("xyz");
      });

      await waitFor(() => {
        expect(result.current.results?.totalCount).toBe(0);
      });

      expect(searchApi.addRecentSearch).not.toHaveBeenCalled();
    });
  });

  describe("Keyboard navigation", () => {
    it("flattens results for navigation", async () => {
      const multiResults = {
        query: "test",
        results: {
          items: [
            {
              id: "item-1",
              type: "item" as const,
              title: "Item 1",
              url: "/item-1",
              icon: "Package",
            },
          ],
          borrowers: [
            {
              id: "borrower-1",
              type: "borrower" as const,
              title: "Borrower 1",
              url: "/borrower-1",
              icon: "User",
            },
          ],
          containers: [],
          locations: [],
        },
        totalCount: 2,
      };
      vi.mocked(searchApi.globalSearch).mockResolvedValue(multiResults);

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0 })
      );

      act(() => {
        result.current.setQuery("test");
      });

      await waitFor(() => {
        expect(result.current.allResults).toHaveLength(2);
      });

      expect(result.current.allResults[0].type).toBe("item");
      expect(result.current.allResults[1].type).toBe("borrower");
    });

    it("tracks selected index", async () => {
      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0 })
      );

      act(() => {
        result.current.setQuery("test");
      });

      await waitFor(() => {
        expect(result.current.results).toBeTruthy();
      });

      expect(result.current.selectedIndex).toBe(-1);
      expect(result.current.selectedResult).toBe(null);

      act(() => {
        result.current.setSelectedIndex(0);
      });

      expect(result.current.selectedIndex).toBe(0);
      expect(result.current.selectedResult).toEqual(
        mockOnlineResults.results.items[0]
      );
    });
  });

  describe("Error handling", () => {
    it("handles API errors gracefully", async () => {
      vi.mocked(searchApi.globalSearch).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0 })
      );

      act(() => {
        result.current.setQuery("test");
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Network error");
      });

      expect(result.current.results).toBe(null);
    });

    it("handles offline search returning null", async () => {
      vi.mocked(networkStatus.useNetworkStatus).mockReturnValue({
        isOnline: false,
        isOffline: true,
        wasOffline: false,
      });

      vi.mocked(offlineSearchHook.useOfflineSearch).mockReturnValue({
        ...mockOfflineSearchReturn,
        search: vi.fn().mockResolvedValue(null),
      });

      const { result } = renderHook(() =>
        useGlobalSearch({ workspaceId: "ws-1", debounceMs: 0 })
      );

      act(() => {
        result.current.setQuery("test");
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Offline search unavailable");
      });
    });
  });
});
