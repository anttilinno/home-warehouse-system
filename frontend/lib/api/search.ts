import { itemsApi } from "./items";
import { borrowersApi } from "./borrowers";
import { containersApi } from "./containers";
import { locationsApi } from "./locations";
import type { Item } from "../types/items";
import type { Borrower } from "../types/borrowers";
import type { Container } from "../types/containers";
import type { Location } from "../types/locations";

// Unified search result type
export type SearchResultType = "item" | "borrower" | "container" | "location";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string; // Display name
  subtitle?: string; // Additional context
  url: string; // Navigation URL
  icon: string; // Icon name for lucide-react
  metadata?: Record<string, string>; // Additional data for display
}

export interface SearchResultsByType {
  items: SearchResult[];
  borrowers: SearchResult[];
  containers: SearchResult[];
  locations: SearchResult[];
}

export interface GlobalSearchResponse {
  query: string;
  results: SearchResultsByType;
  totalCount: number;
}

/**
 * Transform Item to SearchResult
 */
function itemToSearchResult(item: Item): SearchResult {
  return {
    id: item.id,
    type: "item",
    title: item.name,
    subtitle: [item.sku, item.brand, item.model].filter(Boolean).join(" • "),
    url: `/dashboard/inventory?selected=${item.id}`,
    icon: "Package",
    metadata: {
      sku: item.sku || "",
      brand: item.brand || "",
    },
  };
}

/**
 * Transform Borrower to SearchResult
 */
function borrowerToSearchResult(borrower: Borrower): SearchResult {
  return {
    id: borrower.id,
    type: "borrower",
    title: borrower.name,
    subtitle: [borrower.email, borrower.phone].filter(Boolean).join(" • "),
    url: `/dashboard/borrowers?selected=${borrower.id}`,
    icon: "User",
    metadata: {
      email: borrower.email || "",
      phone: borrower.phone || "",
    },
  };
}

/**
 * Transform Container to SearchResult
 */
function containerToSearchResult(container: Container): SearchResult {
  return {
    id: container.id,
    type: "container",
    title: container.name,
    subtitle: container.short_code
      ? `Code: ${container.short_code}`
      : container.description || undefined,
    url: `/dashboard/containers?selected=${container.id}`,
    icon: "Box",
    metadata: {
      short_code: container.short_code || "",
    },
  };
}

/**
 * Transform Location to SearchResult
 */
function locationToSearchResult(location: Location): SearchResult {
  const parts = [location.zone, location.shelf, location.bin].filter(Boolean);
  return {
    id: location.id,
    type: "location",
    title: location.name,
    subtitle: parts.length > 0 ? parts.join(" > ") : location.short_code || undefined,
    url: `/dashboard/locations?selected=${location.id}`,
    icon: "MapPin",
    metadata: {
      short_code: location.short_code || "",
    },
  };
}

/**
 * Global search across all entity types
 *
 * @param workspaceId - Workspace ID
 * @param query - Search query string
 * @param limit - Max results per entity type (default: 5)
 * @returns Combined search results grouped by entity type
 */
export async function globalSearch(
  workspaceId: string,
  query: string,
  limit: number = 5
): Promise<GlobalSearchResponse> {
  if (!workspaceId || !query || query.trim().length === 0) {
    return {
      query: "",
      results: {
        items: [],
        borrowers: [],
        containers: [],
        locations: [],
      },
      totalCount: 0,
    };
  }

  const trimmedQuery = query.trim();

  // Call all search endpoints in parallel
  const [itemsResult, borrowersResult, containersResult, locationsResult] =
    await Promise.allSettled([
      // Items search
      itemsApi.search(workspaceId, trimmedQuery, limit).catch(() => [] as Item[]),

      // Borrowers search
      borrowersApi.search(workspaceId, trimmedQuery, limit).catch(() => [] as Borrower[]),

      // Containers search
      containersApi.search(workspaceId, trimmedQuery, limit).catch(() => [] as Container[]),

      // Locations search
      locationsApi.search(workspaceId, trimmedQuery, limit).catch(() => [] as Location[]),
    ]);

  // Extract results from Promise.allSettled
  const items = itemsResult.status === "fulfilled" ? itemsResult.value : [];
  const borrowers = borrowersResult.status === "fulfilled" ? borrowersResult.value : [];
  const containers = containersResult.status === "fulfilled" ? containersResult.value : [];
  const locations = locationsResult.status === "fulfilled" ? locationsResult.value : [];

  // Transform to unified search results
  const results: SearchResultsByType = {
    items: items.map(itemToSearchResult),
    borrowers: borrowers.map(borrowerToSearchResult),
    containers: containers.map(containerToSearchResult),
    locations: locations.map(locationToSearchResult),
  };

  const totalCount =
    results.items.length +
    results.borrowers.length +
    results.containers.length +
    results.locations.length;

  return {
    query: trimmedQuery,
    results,
    totalCount,
  };
}

// Recent searches localStorage key
const RECENT_SEARCHES_KEY = "global-search-recent";
const MAX_RECENT_SEARCHES = 10;

/**
 * Get recent search queries from localStorage
 */
export function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a search query to recent searches
 */
export function addRecentSearch(query: string): void {
  try {
    const recent = getRecentSearches();
    // Remove if already exists (to move to front)
    const filtered = recent.filter((q) => q !== query);
    // Add to front
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Clear recent searches
 */
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Silently fail
  }
}
