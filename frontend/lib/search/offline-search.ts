/**
 * Offline Search Module
 *
 * Provides offline fuzzy search capability by querying IndexedDB with Fuse.js
 * matching. Merges pending create mutations from the mutation queue so newly
 * created items appear in search results immediately (addresses Pitfall 3-I
 * from research - pending mutations invisible in search).
 *
 * Usage:
 * ```tsx
 * // Build indices once and memoize
 * const indices = useMemo(() => buildSearchIndices(), []);
 *
 * // Search when query changes
 * const results = await offlineGlobalSearch(indices, query);
 * ```
 *
 * The returned GlobalSearchResponse matches the online API format for seamless
 * switching between online and offline modes.
 */

import Fuse from "fuse.js";
import { getAll } from "@/lib/db/offline-db";
import { getPendingMutations } from "@/lib/sync/mutation-queue";
import {
  createItemsFuse,
  createBorrowersFuse,
  createContainersFuse,
  createLocationsFuse,
  createCategoriesFuse,
} from "./fuse-index";
import type {
  GlobalSearchResponse,
  SearchResult,
  SearchResultsByType,
} from "@/lib/api/search";
import type { Item } from "@/lib/types/items";
import type { Borrower } from "@/lib/types/borrowers";
import type { Container } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";
import type { Category } from "@/lib/api/categories";
import type { MutationQueueEntry } from "@/lib/db/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Holds memoized Fuse instances for offline search.
 * Build once with buildSearchIndices() and pass to offlineGlobalSearch().
 */
export interface SearchIndices {
  items: Fuse<Item>;
  borrowers: Fuse<Borrower>;
  containers: Fuse<Container>;
  locations: Fuse<Location>;
  categories: Fuse<Category>;
  /** Timestamp when indices were built (for cache invalidation) */
  lastUpdated: number;
}

// ============================================================================
// Transform Functions (match online API search.ts format)
// ============================================================================

/**
 * Transform Item to SearchResult format.
 * Matches the online API's itemToSearchResult for consistent UI rendering.
 *
 * @param item - Item entity
 * @param isPending - Whether this item is from a pending mutation
 * @returns SearchResult for unified display
 */
function itemToSearchResult(item: Item, isPending?: boolean): SearchResult {
  return {
    id: item.id,
    type: "item",
    title: item.name,
    subtitle: [item.sku, item.brand, item.model].filter(Boolean).join(" - "),
    url: `/dashboard/inventory?selected=${item.id}`,
    icon: "Package",
    metadata: {
      sku: item.sku || "",
      brand: item.brand || "",
      ...(isPending && { isPending: "true" }),
    },
  };
}

/**
 * Transform Borrower to SearchResult format.
 *
 * @param borrower - Borrower entity
 * @param isPending - Whether this borrower is from a pending mutation
 * @returns SearchResult for unified display
 */
function borrowerToSearchResult(
  borrower: Borrower,
  isPending?: boolean
): SearchResult {
  return {
    id: borrower.id,
    type: "borrower",
    title: borrower.name,
    subtitle: [borrower.email, borrower.phone].filter(Boolean).join(" - "),
    url: `/dashboard/borrowers?selected=${borrower.id}`,
    icon: "User",
    metadata: {
      email: borrower.email || "",
      phone: borrower.phone || "",
      ...(isPending && { isPending: "true" }),
    },
  };
}

/**
 * Transform Container to SearchResult format.
 *
 * @param container - Container entity
 * @param isPending - Whether this container is from a pending mutation
 * @returns SearchResult for unified display
 */
function containerToSearchResult(
  container: Container,
  isPending?: boolean
): SearchResult {
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
      ...(isPending && { isPending: "true" }),
    },
  };
}

/**
 * Transform Location to SearchResult format.
 *
 * @param location - Location entity
 * @param isPending - Whether this location is from a pending mutation
 * @returns SearchResult for unified display
 */
function locationToSearchResult(
  location: Location,
  isPending?: boolean
): SearchResult {
  const parts = [location.zone, location.shelf, location.bin].filter(Boolean);
  return {
    id: location.id,
    type: "location",
    title: location.name,
    subtitle:
      parts.length > 0 ? parts.join(" > ") : location.short_code || undefined,
    url: `/dashboard/locations?selected=${location.id}`,
    icon: "MapPin",
    metadata: {
      short_code: location.short_code || "",
      ...(isPending && { isPending: "true" }),
    },
  };
}

// ============================================================================
// Index Building
// ============================================================================

/**
 * Build search indices from IndexedDB data.
 *
 * Loads all entities from IndexedDB and creates Fuse.js indices for each type.
 * The returned indices should be memoized in components to avoid re-indexing
 * on every search (addresses Pitfall 3-F from research).
 *
 * @returns SearchIndices object with Fuse instances for all entity types
 */
export async function buildSearchIndices(): Promise<SearchIndices> {
  const [items, borrowers, containers, locations, categories] =
    await Promise.all([
      getAll<Item>("items"),
      getAll<Borrower>("borrowers"),
      getAll<Container>("containers"),
      getAll<Location>("locations"),
      getAll<Category>("categories"),
    ]);

  return {
    items: createItemsFuse(items),
    borrowers: createBorrowersFuse(borrowers),
    containers: createContainersFuse(containers),
    locations: createLocationsFuse(locations),
    categories: createCategoriesFuse(categories),
    lastUpdated: Date.now(),
  };
}

// ============================================================================
// Pending Mutations Handling
// ============================================================================

/**
 * Entity type mapping from mutation entity names to search result types.
 */
const ENTITY_TYPE_MAP: Record<string, keyof SearchResultsByType> = {
  items: "items",
  borrowers: "borrowers",
  containers: "containers",
  locations: "locations",
};

/**
 * Extract pending create mutations and convert to searchable entities.
 *
 * Pending creates are mutations queued while offline that haven't synced yet.
 * We include them in search results so users can find newly created items
 * immediately (optimistic UI pattern).
 *
 * @param pendingMutations - All pending mutations from the queue
 * @param existingIds - Set of IDs already in IndexedDB (to avoid duplicates)
 * @returns Pending entities grouped by type
 */
function extractPendingCreates(
  pendingMutations: MutationQueueEntry[],
  existingIds: {
    items: Set<string>;
    borrowers: Set<string>;
    containers: Set<string>;
    locations: Set<string>;
  }
): {
  items: Item[];
  borrowers: Borrower[];
  containers: Container[];
  locations: Location[];
} {
  const pending = {
    items: [] as Item[],
    borrowers: [] as Borrower[],
    containers: [] as Container[],
    locations: [] as Location[],
  };

  for (const mutation of pendingMutations) {
    // Only process create operations
    if (mutation.operation !== "create") continue;

    // Map entity type
    const entityType = ENTITY_TYPE_MAP[mutation.entity];
    if (!entityType) continue;

    // Extract entity from payload
    const payload = mutation.payload as Record<string, unknown>;
    const id = (payload.id as string) || mutation.idempotencyKey;

    // Skip if already in IndexedDB (optimistic update already applied)
    if (existingIds[entityType]?.has(id)) continue;

    // Create entity with minimal required fields
    const entity = {
      ...payload,
      id,
      workspace_id: payload.workspace_id || "",
      created_at: new Date(mutation.timestamp).toISOString(),
      updated_at: new Date(mutation.timestamp).toISOString(),
    };

    // Add to appropriate array
    switch (entityType) {
      case "items":
        pending.items.push(entity as Item);
        break;
      case "borrowers":
        pending.borrowers.push(entity as Borrower);
        break;
      case "containers":
        pending.containers.push(entity as Container);
        break;
      case "locations":
        pending.locations.push(entity as Location);
        break;
    }
  }

  return pending;
}

/**
 * Search pending entities with Fuse.js and merge into results.
 *
 * Creates temporary Fuse indices for pending entities and searches them,
 * then merges results with existing search results, marking them as pending.
 *
 * @param pending - Pending entities grouped by type
 * @param query - Search query
 * @param limit - Max results per type
 * @returns Search results from pending entities
 */
function searchPendingEntities(
  pending: {
    items: Item[];
    borrowers: Borrower[];
    containers: Container[];
    locations: Location[];
  },
  query: string,
  limit: number
): SearchResultsByType {
  const results: SearchResultsByType = {
    items: [],
    borrowers: [],
    containers: [],
    locations: [],
  };

  // Search pending items
  if (pending.items.length > 0) {
    const fuse = createItemsFuse(pending.items);
    const fuseResults = fuse.search(query, { limit });
    results.items = fuseResults.map((r) => itemToSearchResult(r.item, true));
  }

  // Search pending borrowers
  if (pending.borrowers.length > 0) {
    const fuse = createBorrowersFuse(pending.borrowers);
    const fuseResults = fuse.search(query, { limit });
    results.borrowers = fuseResults.map((r) =>
      borrowerToSearchResult(r.item, true)
    );
  }

  // Search pending containers
  if (pending.containers.length > 0) {
    const fuse = createContainersFuse(pending.containers);
    const fuseResults = fuse.search(query, { limit });
    results.containers = fuseResults.map((r) =>
      containerToSearchResult(r.item, true)
    );
  }

  // Search pending locations
  if (pending.locations.length > 0) {
    const fuse = createLocationsFuse(pending.locations);
    const fuseResults = fuse.search(query, { limit });
    results.locations = fuseResults.map((r) =>
      locationToSearchResult(r.item, true)
    );
  }

  return results;
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Perform offline global search across all entity types.
 *
 * Queries the pre-built Fuse.js indices and merges pending create mutations
 * from the mutation queue. Returns results in the same GlobalSearchResponse
 * format as the online API for seamless online/offline switching.
 *
 * Performance: Completes within 300ms for datasets under 5000 items (SRCH-01).
 *
 * @param indices - Pre-built SearchIndices from buildSearchIndices()
 * @param query - Search query string
 * @param limit - Max results per entity type (default: 5)
 * @returns GlobalSearchResponse matching online API format
 */
export async function offlineGlobalSearch(
  indices: SearchIndices,
  query: string,
  limit: number = 5
): Promise<GlobalSearchResponse> {
  // Return empty results for empty query
  if (!query || query.trim().length === 0) {
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

  // Search each Fuse index
  const itemResults = indices.items.search(trimmedQuery, { limit });
  const borrowerResults = indices.borrowers.search(trimmedQuery, { limit });
  const containerResults = indices.containers.search(trimmedQuery, { limit });
  const locationResults = indices.locations.search(trimmedQuery, { limit });

  // Transform to SearchResult format
  const results: SearchResultsByType = {
    items: itemResults.map((r) => itemToSearchResult(r.item)),
    borrowers: borrowerResults.map((r) => borrowerToSearchResult(r.item)),
    containers: containerResults.map((r) => containerToSearchResult(r.item)),
    locations: locationResults.map((r) => locationToSearchResult(r.item)),
  };

  // Get pending create mutations and merge
  try {
    const pendingMutations = await getPendingMutations();

    if (pendingMutations.length > 0) {
      // Build sets of existing IDs to avoid duplicates
      const existingIds = {
        items: new Set(results.items.map((r) => r.id)),
        borrowers: new Set(results.borrowers.map((r) => r.id)),
        containers: new Set(results.containers.map((r) => r.id)),
        locations: new Set(results.locations.map((r) => r.id)),
      };

      // Extract pending entities
      const pending = extractPendingCreates(pendingMutations, existingIds);

      // Search pending entities
      const pendingResults = searchPendingEntities(pending, trimmedQuery, limit);

      // Merge pending results (pending items appear at end of each section)
      results.items = [...results.items, ...pendingResults.items].slice(
        0,
        limit
      );
      results.borrowers = [
        ...results.borrowers,
        ...pendingResults.borrowers,
      ].slice(0, limit);
      results.containers = [
        ...results.containers,
        ...pendingResults.containers,
      ].slice(0, limit);
      results.locations = [
        ...results.locations,
        ...pendingResults.locations,
      ].slice(0, limit);
    }
  } catch (error) {
    // If mutation queue access fails, continue with IndexedDB results only
    console.warn("[OfflineSearch] Failed to fetch pending mutations:", error);
  }

  // Calculate total count
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

// ============================================================================
// Re-export for Convenience
// ============================================================================

export type { GlobalSearchResponse, SearchResult, SearchResultsByType };
