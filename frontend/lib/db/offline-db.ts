/**
 * Offline Database Module
 *
 * IndexedDB-based storage for offline data caching using the idb library.
 * Provides typed CRUD operations for all entity stores.
 */

import { openDB as idbOpen, type IDBPDatabase, type StoreNames } from "idb";
import type { OfflineDBSchema, SyncMeta } from "./types";

const DB_NAME = "hws-offline-v1";
const DB_VERSION = 4;

// Singleton promise for the database connection
let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

/**
 * Request persistent storage from the browser.
 * This helps prevent data eviction on Safari/iOS.
 * Called once on first database open.
 */
async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  if (!navigator.storage?.persist) return false;

  try {
    const persisted = await navigator.storage.persist();
    if (persisted) {
      console.log("[OfflineDB] Persistent storage granted");
    } else {
      console.log("[OfflineDB] Persistent storage denied - data may be evicted");
    }
    return persisted;
  } catch (error) {
    console.warn("[OfflineDB] Failed to request persistent storage:", error);
    return false;
  }
}

/**
 * Get the database instance, creating it if necessary.
 * Uses singleton pattern to share connection across the app.
 */
export async function getDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment");
  }

  if (!dbPromise) {
    dbPromise = idbOpen<OfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Create entity stores with 'id' as keyPath (v1)
        if (!db.objectStoreNames.contains("items")) {
          db.createObjectStore("items", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("inventory")) {
          db.createObjectStore("inventory", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("locations")) {
          db.createObjectStore("locations", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("containers")) {
          db.createObjectStore("containers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("borrowers")) {
          db.createObjectStore("borrowers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("loans")) {
          db.createObjectStore("loans", { keyPath: "id" });
        }

        // Sync metadata store uses 'key' as keyPath (v1)
        if (!db.objectStoreNames.contains("syncMeta")) {
          db.createObjectStore("syncMeta", { keyPath: "key" });
        }

        // Mutation queue store for offline mutations (v2)
        if (oldVersion < 2) {
          const mutationStore = db.createObjectStore("mutationQueue", {
            keyPath: "id",
            autoIncrement: true,
          });
          // Indexes for efficient queries
          mutationStore.createIndex("status", "status", { unique: false });
          mutationStore.createIndex("entity", "entity", { unique: false });
          mutationStore.createIndex("timestamp", "timestamp", { unique: false });
          mutationStore.createIndex("idempotencyKey", "idempotencyKey", {
            unique: true,
          });
        }

        // Conflict log store for tracking sync conflicts (v3)
        if (oldVersion < 3) {
          const conflictStore = db.createObjectStore("conflictLog", {
            keyPath: "id",
            autoIncrement: true,
          });
          // Indexes for querying conflict history
          conflictStore.createIndex("entityType", "entityType", {
            unique: false,
          });
          conflictStore.createIndex("timestamp", "timestamp", { unique: false });
          conflictStore.createIndex("resolution", "resolution", {
            unique: false,
          });
        }

        // Form drafts store for persisting form data before submission (v4)
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains("formDrafts")) {
            db.createObjectStore("formDrafts", { keyPath: "id" });
          }
        }

        console.log(
          "[OfflineDB] Database schema created/upgraded to version",
          DB_VERSION
        );
      },
    });

    // Request persistent storage (non-blocking)
    requestPersistentStorage();
  }

  return dbPromise;
}

// ============================================================================
// Generic CRUD Operations
// ============================================================================

/**
 * Get all records from a store
 */
export async function getAll<T>(
  storeName: StoreNames<OfflineDBSchema>
): Promise<T[]> {
  const db = await getDB();
  return db.getAll(storeName) as Promise<T[]>;
}

/**
 * Get a single record by ID
 */
export async function getById<T>(
  storeName: StoreNames<OfflineDBSchema>,
  id: string
): Promise<T | undefined> {
  const db = await getDB();
  return db.get(storeName, id) as Promise<T | undefined>;
}

/**
 * Put multiple records (batch insert/update)
 * Uses a transaction for better performance
 */
export async function putAll<T extends { id: string } | { key: string }>(
  storeName: StoreNames<OfflineDBSchema>,
  items: T[]
): Promise<void> {
  if (items.length === 0) return;

  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);

  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.put(item as any);
  }

  await tx.done;
}

/**
 * Put a single record (insert or update)
 */
export async function put<T extends { id: string } | { key: string }>(
  storeName: StoreNames<OfflineDBSchema>,
  item: T
): Promise<void> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.put(storeName, item as any);
}

/**
 * Delete a single record by ID
 */
export async function deleteById(
  storeName: StoreNames<OfflineDBSchema>,
  id: string
): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

/**
 * Clear all records in a store
 */
export async function clearStore(
  storeName: StoreNames<OfflineDBSchema>
): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

// ============================================================================
// Sync Metadata Operations
// ============================================================================

/**
 * Get sync metadata by key
 */
export async function getSyncMeta(key: string): Promise<SyncMeta | undefined> {
  const db = await getDB();
  return db.get("syncMeta", key);
}

/**
 * Set sync metadata
 */
export async function setSyncMeta(
  key: string,
  value: string | number | boolean
): Promise<void> {
  const db = await getDB();
  await db.put("syncMeta", {
    key,
    value,
    updatedAt: Date.now(),
  });
}

// ============================================================================
// Database Initialization
// ============================================================================

/**
 * Initialize the offline database.
 * Call this on app startup to ensure database is ready.
 *
 * @returns Object with dbReady status and persistentStorage grant status
 */
export async function initDB(): Promise<{
  dbReady: boolean;
  persistentStorage: boolean;
}> {
  // Skip in non-browser environments (SSR)
  if (typeof indexedDB === "undefined") {
    return { dbReady: false, persistentStorage: false };
  }

  try {
    await getDB();
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    return { dbReady: true, persistentStorage: persisted };
  } catch (error) {
    console.error("[OfflineDB] Failed to initialize offline database:", error);
    return { dbReady: false, persistentStorage: false };
  }
}

/**
 * Close the database connection.
 * Useful for testing or cleanup.
 */
export async function closeDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/**
 * Delete the entire database.
 * Use with caution - all offline data will be lost.
 */
export async function deleteDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }

  if (typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        console.warn("[OfflineDB] Database deletion blocked - connections still open");
        resolve();
      };
    });
  }
}
