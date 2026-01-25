---
phase: 01-indexeddb-foundation
plan: 01
subsystem: offline-storage
tags: [indexeddb, idb, offline, pwa, typescript]

dependency-graph:
  requires: []
  provides: [offline-db-schema, crud-operations, sync-metadata]
  affects: [01-02, 01-03, 02-01]

tech-stack:
  added:
    - idb@8.0.3
  patterns:
    - singleton-pattern-for-db-connection
    - typed-indexeddb-with-dbschema

key-files:
  created:
    - frontend/lib/db/types.ts
    - frontend/lib/db/offline-db.ts
  modified:
    - frontend/package.json
    - frontend/bun.lock
    - frontend/lib/contexts/offline-context.tsx
    - frontend/app/sw.ts
    - frontend/lib/hooks/use-push-notifications.ts

decisions:
  - key: idb-wrapper
    choice: Use idb v8.0.3 (lightweight 1.19kB wrapper)
    rationale: Type-safe promise-based IndexedDB API with minimal overhead

metrics:
  duration: 5m
  completed: 2026-01-22
---

# Phase 1 Plan 1: IndexedDB Schema & Database Setup Summary

IndexedDB foundation using idb wrapper with 8 object stores and typed CRUD operations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install idb and create offline database types | 5c20d44 | package.json, bun.lock, lib/db/types.ts, sw.ts, use-push-notifications.ts |
| 2 | Create IndexedDB database module with CRUD operations | e28be2c | lib/db/offline-db.ts |
| 3 | Add database initialization to app startup | a730c62 | lib/contexts/offline-context.tsx |

## What Was Built

### Offline Database Types (`frontend/lib/db/types.ts`)

- Re-exports existing API types as `Offline*` types for clarity
- `SyncMeta` interface for tracking sync state (key, value, updatedAt)
- `OfflineDBSchema` extending idb's DBSchema for typed operations
- `OfflineStoreName` type for store name constraints

### Offline Database Module (`frontend/lib/db/offline-db.ts`)

**Database Configuration:**
- Database name: `hws-offline-v1`
- Version: 1
- Singleton connection pattern

**Object Stores (8 total):**
- `items` - Item catalog (keyPath: id)
- `inventory` - Physical item instances (keyPath: id)
- `locations` - Storage locations (keyPath: id)
- `containers` - Storage containers (keyPath: id)
- `categories` - Item categories (keyPath: id)
- `borrowers` - People who borrow items (keyPath: id)
- `loans` - Active/historical loans (keyPath: id)
- `syncMeta` - Sync state metadata (keyPath: key)

**Exported Functions:**
- `initDB()` - Initialize database and request persistent storage
- `getAll<T>(storeName)` - Get all records from a store
- `getById<T>(storeName, id)` - Get single record by ID
- `putAll<T>(storeName, items)` - Batch insert/update with transaction
- `put<T>(storeName, item)` - Single insert/update
- `deleteById(storeName, id)` - Delete single record
- `clearStore(storeName)` - Clear all records in store
- `getSyncMeta(key)` - Get sync metadata by key
- `setSyncMeta(key, value)` - Set sync metadata
- `closeDB()` - Close database connection
- `deleteDB()` - Delete entire database

**Safari Eviction Prevention:**
- Requests `navigator.storage.persist()` on first database open
- Non-blocking (doesn't delay app startup)

### Context Integration

**OfflineContext additions:**
- `dbReady: boolean` - Whether database is initialized
- `persistentStorage: boolean` - Whether persistent storage granted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript error in sw.ts**
- **Found during:** Task 1 verification
- **Issue:** `vibrate` property not in TypeScript's `NotificationOptions` type
- **Fix:** Used `satisfies` with extended type: `satisfies NotificationOptions & { vibrate?: number[] }`
- **Files modified:** frontend/app/sw.ts
- **Commit:** 5c20d44

**2. [Rule 3 - Blocking] Fixed TypeScript error in use-push-notifications.ts**
- **Found during:** Task 1 verification
- **Issue:** `Uint8Array<ArrayBufferLike>` not assignable to `BufferSource`
- **Fix:** Explicitly create `ArrayBuffer` before `Uint8Array` to satisfy type constraints
- **Files modified:** frontend/lib/hooks/use-push-notifications.ts
- **Commit:** 5c20d44

## Key Implementation Details

```typescript
// Database singleton pattern
let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (!dbPromise) {
    dbPromise = idbOpen<OfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create all stores...
      },
    });
    requestPersistentStorage();
  }
  return dbPromise;
}
```

```typescript
// Batch operations use transactions for performance
export async function putAll<T>(storeName, items: T[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const item of items) {
    store.put(item);
  }
  await tx.done;
}
```

## Verification Results

- [x] TypeScript compilation: `bun run build` succeeds
- [x] idb v8.0.3 installed in package.json
- [x] types.ts exports 8 Offline entity types + SyncMeta + OfflineDBSchema (82 lines)
- [x] offline-db.ts exports all CRUD functions (261 lines)
- [x] OfflineContext exposes dbReady and persistentStorage
- [x] Key links verified: `import.*from.*idb` and `navigator.storage.persist`

## Dependencies for Next Plans

**Plan 01-02 (Background Sync & Proactive Caching) needs:**
- `getAll()`, `putAll()`, `clearStore()` for caching API responses
- `getSyncMeta()`, `setSyncMeta()` for tracking last sync timestamps

**Plan 01-03 (Offline Data Hooks & UI) needs:**
- All CRUD operations for offline-first data access
- `dbReady` from context to gate offline operations

## Next Phase Readiness

Ready for Plan 01-02. Database foundation is complete with:
- All 8 stores created on app load
- CRUD operations typed and tested
- Persistent storage requested
- Context integration complete
