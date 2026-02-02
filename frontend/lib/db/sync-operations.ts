/**
 * Sync Operations Module
 *
 * Functions to synchronize data from the API to IndexedDB for offline access.
 * Implements proactive caching by fetching all workspace data on app load.
 */

import { itemsApi } from "@/lib/api/items";
import { inventoryApi } from "@/lib/api/inventory";
import { locationsApi } from "@/lib/api/locations";
import { containersApi } from "@/lib/api/containers";
import { categoriesApi } from "@/lib/api/categories";
import { borrowersApi } from "@/lib/api/borrowers";
import { loansApi } from "@/lib/api/loans";
import { putAll, clearStore, setSyncMeta, getSyncMeta } from "./offline-db";

// Backend's maximum page size
const MAX_PAGE_SIZE = 100;

/**
 * Paginated response structure from the API
 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  total_pages: number;
}

/**
 * Fetch all pages of a paginated API endpoint
 *
 * @param fetchPage - Function that fetches a single page
 * @returns All items from all pages
 */
async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<T>>
): Promise<T[]> {
  const allItems: T[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const response = await fetchPage(currentPage, MAX_PAGE_SIZE);
    allItems.push(...response.items);
    totalPages = response.total_pages;
    currentPage++;
  } while (currentPage <= totalPages);

  return allItems;
}

/**
 * Entity types that can be synced
 */
export type EntityType =
  | "items"
  | "inventory"
  | "locations"
  | "containers"
  | "categories"
  | "borrowers"
  | "loans";

/**
 * Result of a full workspace sync operation
 */
export interface SyncResult {
  /** Whether the sync completed successfully */
  success: boolean;
  /** Timestamp when the sync completed */
  timestamp: number;
  /** Number of records synced for each entity type */
  counts: Record<EntityType, number>;
  /** Error message if sync failed */
  error?: string;
}

/**
 * Sync a single entity type from API to IndexedDB.
 *
 * @param entityType - The type of entity to sync
 * @param fetchFn - Function that fetches all data from the API
 * @returns Number of items synced
 */
async function syncEntity<T extends { id: string }>(
  entityType: EntityType,
  fetchFn: () => Promise<T[]>
): Promise<number> {
  const data = await fetchFn();
  await clearStore(entityType);
  await putAll(entityType, data);
  return data.length;
}

/**
 * Sync all workspace data from the API to IndexedDB.
 *
 * This function:
 * 1. Checks if workspace changed and clears data if so
 * 2. Fetches all 7 entity types in parallel
 * 3. Stores them in IndexedDB
 * 4. Records sync metadata (timestamp and workspace ID)
 *
 * @param workspaceId - The workspace to sync data for
 * @returns Sync result with success status, timestamp, and counts
 */
export async function syncWorkspaceData(workspaceId: string): Promise<SyncResult> {
  const timestamp = Date.now();

  try {
    // Check if workspace changed - clear all data if so
    const storedWorkspaceId = await getSyncMeta("workspaceId");
    if (storedWorkspaceId?.value !== workspaceId) {
      console.log("[Sync] Workspace changed, clearing all cached data");
      await Promise.all([
        clearStore("items"),
        clearStore("inventory"),
        clearStore("locations"),
        clearStore("containers"),
        clearStore("categories"),
        clearStore("borrowers"),
        clearStore("loans"),
      ]);
    }

    console.log("[Sync] Starting workspace data sync for:", workspaceId);

    // Sync all entities in parallel using pagination
    // Backend has max page size of 100, so we paginate through all results
    const [items, inventory, locations, containers, categories, borrowers, loans] =
      await Promise.all([
        syncEntity("items", () =>
          fetchAllPages((page, limit) => itemsApi.list(workspaceId, { page, limit }))
        ),
        syncEntity("inventory", () =>
          fetchAllPages((page, limit) => inventoryApi.list(workspaceId, { page, limit }))
        ),
        syncEntity("locations", () =>
          fetchAllPages((page, limit) => locationsApi.list(workspaceId, { page, limit }))
        ),
        syncEntity("containers", () =>
          fetchAllPages((page, limit) => containersApi.list(workspaceId, { page, limit }))
        ),
        syncEntity("categories", () => categoriesApi.list(workspaceId)),
        syncEntity("borrowers", () =>
          fetchAllPages((page, limit) => borrowersApi.list(workspaceId, { page, limit }))
        ),
        syncEntity("loans", () =>
          fetchAllPages((page, limit) => loansApi.list(workspaceId, { page, limit }))
        ),
      ]);

    // Record sync metadata
    await setSyncMeta("lastSync", timestamp);
    await setSyncMeta("workspaceId", workspaceId);

    const counts = {
      items,
      inventory,
      locations,
      containers,
      categories,
      borrowers,
      loans,
    };

    console.log("[Sync] Workspace data sync complete:", counts);

    return {
      success: true,
      timestamp,
      counts,
    };
  } catch (error) {
    console.error("[Sync] Failed to sync workspace data:", error);
    return {
      success: false,
      timestamp,
      counts: {
        items: 0,
        inventory: 0,
        locations: 0,
        containers: 0,
        categories: 0,
        borrowers: 0,
        loans: 0,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the last sync timestamp from IndexedDB
 *
 * @returns The timestamp of the last successful sync, or null if never synced
 */
export async function getLastSyncTimestamp(): Promise<number | null> {
  const meta = await getSyncMeta("lastSync");
  if (meta?.value && typeof meta.value === "number") {
    return meta.value;
  }
  return null;
}

/**
 * Get the workspace ID that was last synced
 *
 * @returns The workspace ID, or null if never synced
 */
export async function getSyncedWorkspaceId(): Promise<string | null> {
  const meta = await getSyncMeta("workspaceId");
  if (meta?.value && typeof meta.value === "string") {
    return meta.value;
  }
  return null;
}
