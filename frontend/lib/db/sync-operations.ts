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

    // Sync all entities in parallel
    // Using high limit (10000) to fetch all at once - appropriate for home inventory
    // systems which typically have hundreds to low thousands of items
    const [items, inventory, locations, containers, categories, borrowers, loans] =
      await Promise.all([
        syncEntity("items", async () => {
          const response = await itemsApi.list(workspaceId, { limit: 10000 });
          return response.items;
        }),
        syncEntity("inventory", async () => {
          const response = await inventoryApi.list(workspaceId, { limit: 10000 });
          return response.items;
        }),
        syncEntity("locations", async () => {
          const response = await locationsApi.list(workspaceId, { limit: 10000 });
          return response.items;
        }),
        syncEntity("containers", async () => {
          const response = await containersApi.list(workspaceId, { limit: 10000 });
          return response.items;
        }),
        syncEntity("categories", () => categoriesApi.list(workspaceId)),
        syncEntity("borrowers", async () => {
          const response = await borrowersApi.list(workspaceId, { limit: 10000 });
          return response.items;
        }),
        syncEntity("loans", async () => {
          const response = await loansApi.list(workspaceId, { limit: 10000 });
          return response.items;
        }),
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
