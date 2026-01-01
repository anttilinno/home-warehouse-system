import { db, type EntityType } from './db';
import {
  syncApi,
  type SyncEntityType,
  type BatchOperation,
  type Item,
  type Location,
  type Container,
  type Inventory,
  type Category,
  type Borrower,
  type Loan,
} from '@/lib/api';
import {
  getNextMutation,
  completeMutation,
  failMutation,
  getMutationCount,
  getPendingMutations,
  completeAllMutations,
} from './offline-queue';

// Type for sync event callbacks
type SyncEventCallback = (event: SyncEvent) => void;

interface SyncEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'mutation_synced' | 'mutation_failed';
  entity?: EntityType;
  message?: string;
  pendingCount?: number;
}

// Event listeners for sync status
const listeners: Set<SyncEventCallback> = new Set();

export function addSyncListener(callback: SyncEventCallback): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emitSyncEvent(event: SyncEvent): void {
  listeners.forEach(cb => cb(event));
}

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// Map frontend entity types to backend sync entity types
const entityTypeMap: Record<EntityType, SyncEntityType> = {
  items: 'item',
  locations: 'location',
  containers: 'container',
  inventory: 'inventory',
  categories: 'category',
  borrowers: 'borrower',
  loans: 'loan',
};

// Map backend entity types to frontend entity types
const reverseEntityTypeMap: Record<SyncEntityType, EntityType> = {
  item: 'items',
  location: 'locations',
  container: 'containers',
  inventory: 'inventory',
  category: 'categories',
  borrower: 'borrowers',
  loan: 'loans',
};

/**
 * Pull latest data from server using delta sync.
 * Uses a single API call instead of multiple entity-specific calls.
 */
export async function pullData(workspaceId: string, entities?: EntityType[]): Promise<void> {
  if (!isOnline()) {
    throw new Error('Cannot sync while offline');
  }

  emitSyncEvent({ type: 'start', message: 'Starting data sync...' });

  try {
    // Get last sync time (stored as ISO string now)
    const syncState = await db.syncState.get(['items', workspaceId]);
    const lastSyncTime = syncState?.lastSyncAt ? new Date(syncState.lastSyncAt).toISOString() : undefined;

    // Convert frontend entity types to backend entity types for filtering
    const syncEntityTypes = entities?.map(e => entityTypeMap[e]);

    emitSyncEvent({ type: 'progress', message: 'Fetching changes from server...' });

    // Single API call for all entities
    const response = await syncApi.getDelta({
      modifiedSince: lastSyncTime,
      entityTypes: syncEntityTypes,
    });

    const now = new Date(response.metadata.server_time).getTime();

    // Process each entity type from the response
    if (response.items.length > 0) {
      emitSyncEvent({ type: 'progress', entity: 'items', message: `Updating ${response.items.length} items...` });
      await db.items.bulkPut(
        response.items.map((item: Item) => ({ ...item, _syncedAt: now, _workspaceId: workspaceId }))
      );
    }

    if (response.locations.length > 0) {
      emitSyncEvent({ type: 'progress', entity: 'locations', message: `Updating ${response.locations.length} locations...` });
      await db.locations.bulkPut(
        response.locations.map((loc: Location) => ({ ...loc, _syncedAt: now, _workspaceId: workspaceId }))
      );
    }

    if (response.containers.length > 0) {
      emitSyncEvent({ type: 'progress', entity: 'containers', message: `Updating ${response.containers.length} containers...` });
      await db.containers.bulkPut(
        response.containers.map((c: Container) => ({ ...c, _syncedAt: now, _workspaceId: workspaceId }))
      );
    }

    if (response.inventory.length > 0) {
      emitSyncEvent({ type: 'progress', entity: 'inventory', message: `Updating ${response.inventory.length} inventory records...` });
      await db.inventory.bulkPut(
        response.inventory.map((inv: Inventory) => ({ ...inv, _syncedAt: now, _workspaceId: workspaceId }))
      );
    }

    if (response.categories.length > 0) {
      emitSyncEvent({ type: 'progress', entity: 'categories', message: `Updating ${response.categories.length} categories...` });
      await db.categories.bulkPut(
        response.categories.map((cat: Category) => ({ ...cat, _syncedAt: now, _workspaceId: workspaceId }))
      );
    }

    if (response.borrowers.length > 0) {
      emitSyncEvent({ type: 'progress', entity: 'borrowers', message: `Updating ${response.borrowers.length} borrowers...` });
      await db.borrowers.bulkPut(
        response.borrowers.map((b: Borrower) => ({ ...b, _syncedAt: now, _workspaceId: workspaceId }))
      );
    }

    // Process deleted records
    if (response.deleted.length > 0) {
      emitSyncEvent({ type: 'progress', message: `Processing ${response.deleted.length} deletions...` });
      for (const deleted of response.deleted) {
        const frontendType = reverseEntityTypeMap[deleted.entity_type as SyncEntityType];
        if (frontendType) {
          await deleteFromCache(frontendType, deleted.entity_id);
        }
      }
    }

    // Update sync state for all entities that we sync
    const entitiesToUpdate = entities || ['items', 'locations', 'containers', 'inventory', 'categories', 'borrowers'];
    for (const entity of entitiesToUpdate) {
      await db.syncState.put({
        entity: entity as EntityType,
        workspaceId,
        lastSyncAt: now,
      });
    }

    emitSyncEvent({ type: 'complete', message: 'Data sync complete' });
  } catch (error) {
    console.error('Failed to sync data:', error);
    emitSyncEvent({
      type: 'error',
      message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    throw error;
  }
}

/**
 * Delete an entity from the local cache
 */
async function deleteFromCache(entity: EntityType, entityId: string): Promise<void> {
  switch (entity) {
    case 'items':
      await db.items.delete(entityId);
      break;
    case 'locations':
      await db.locations.delete(entityId);
      break;
    case 'containers':
      await db.containers.delete(entityId);
      break;
    case 'inventory':
      await db.inventory.delete(entityId);
      break;
    case 'categories':
      await db.categories.delete(entityId);
      break;
    case 'borrowers':
      await db.borrowers.delete(entityId);
      break;
  }
}

/**
 * Push pending mutations to server using batch API.
 * More efficient than individual API calls.
 */
export async function pushMutations(workspaceId: string): Promise<{
  synced: number;
  failed: number;
}> {
  if (!isOnline()) {
    return { synced: 0, failed: 0 };
  }

  const pendingCount = await getMutationCount(workspaceId);
  if (pendingCount === 0) {
    return { synced: 0, failed: 0 };
  }

  emitSyncEvent({ type: 'start', pendingCount, message: `Syncing ${pendingCount} pending changes...` });

  // Get all pending mutations
  const mutations = await getPendingMutations(workspaceId);
  if (mutations.length === 0) {
    return { synced: 0, failed: 0 };
  }

  // Convert mutations to batch operations
  const operations: BatchOperation[] = mutations.map(m => ({
    operation: m.type.toLowerCase() as 'create' | 'update' | 'delete',
    entity_type: entityTypeMap[m.entity],
    id: m.entityId,
    data: m.type !== 'DELETE' ? m.payload as Record<string, unknown> : undefined,
  }));

  try {
    const response = await syncApi.batch({
      operations,
      allow_partial: true,
    });

    // Process results
    let synced = 0;
    let failed = 0;
    const successfulIds: number[] = [];

    for (let i = 0; i < response.results.length; i++) {
      const result = response.results[i];
      const mutation = mutations[i];

      if (result.success) {
        synced++;
        if (mutation.id) {
          successfulIds.push(mutation.id);
        }
        emitSyncEvent({
          type: 'mutation_synced',
          entity: mutation.entity,
          pendingCount: pendingCount - synced - failed,
        });
      } else {
        failed++;
        if (mutation.id) {
          await failMutation(mutation.id, result.error || 'Unknown error');
        }
        emitSyncEvent({
          type: 'mutation_failed',
          entity: mutation.entity,
          message: `Failed to sync ${mutation.type} ${mutation.entity}: ${result.error}`,
        });
      }
    }

    // Mark all successful mutations as complete
    if (successfulIds.length > 0) {
      await completeAllMutations(successfulIds);
    }

    emitSyncEvent({ type: 'complete', message: `Sync complete: ${synced} synced, ${failed} failed` });

    return { synced, failed };
  } catch (error) {
    // If batch API fails entirely, fall back to individual processing
    console.error('Batch sync failed, falling back to individual processing:', error);
    return pushMutationsIndividual(workspaceId);
  }
}

/**
 * Fallback: Push mutations one by one (used if batch fails)
 */
async function pushMutationsIndividual(workspaceId: string): Promise<{
  synced: number;
  failed: number;
}> {
  let synced = 0;
  let failed = 0;

  while (true) {
    const mutation = await getNextMutation(workspaceId);
    if (!mutation || !mutation.id) break;

    try {
      await processMutationIndividual(mutation);
      await completeMutation(mutation.id);
      synced++;
      emitSyncEvent({
        type: 'mutation_synced',
        entity: mutation.entity,
        pendingCount: await getMutationCount(workspaceId),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const canRetry = await failMutation(mutation.id, errorMessage);

      if (!canRetry) {
        failed++;
        emitSyncEvent({
          type: 'mutation_failed',
          entity: mutation.entity,
          message: `Failed to sync ${mutation.type} ${mutation.entity}: ${errorMessage}`,
        });
      }
      break; // Stop on first error to maintain order
    }
  }

  return { synced, failed };
}

// Import the individual entity APIs for fallback processing
import {
  itemsApi,
  locationsApi,
  containersApi,
  inventoryApi,
  categoriesApi,
  borrowersApi,
} from '@/lib/api';

async function processMutationIndividual(mutation: {
  type: string;
  entity: EntityType;
  entityId?: string;
  payload: unknown;
}): Promise<void> {
  const { type, entity, entityId, payload } = mutation;

  switch (entity) {
    case 'items':
      if (type === 'CREATE') {
        await itemsApi.create(payload as Parameters<typeof itemsApi.create>[0]);
      } else if (type === 'UPDATE' && entityId) {
        await itemsApi.update(entityId, payload as Parameters<typeof itemsApi.update>[1]);
      } else if (type === 'DELETE' && entityId) {
        await itemsApi.delete(entityId);
      }
      break;

    case 'locations':
      if (type === 'CREATE') {
        await locationsApi.create(payload as Parameters<typeof locationsApi.create>[0]);
      } else if (type === 'UPDATE' && entityId) {
        await locationsApi.update(entityId, payload as Parameters<typeof locationsApi.update>[1]);
      } else if (type === 'DELETE' && entityId) {
        await locationsApi.delete(entityId);
      }
      break;

    case 'containers':
      if (type === 'CREATE') {
        await containersApi.create(payload as Parameters<typeof containersApi.create>[0]);
      } else if (type === 'UPDATE' && entityId) {
        await containersApi.update(entityId, payload as Parameters<typeof containersApi.update>[1]);
      } else if (type === 'DELETE' && entityId) {
        await containersApi.delete(entityId);
      }
      break;

    case 'inventory':
      if (type === 'CREATE') {
        await inventoryApi.create(payload as Parameters<typeof inventoryApi.create>[0]);
      } else if (type === 'UPDATE' && entityId) {
        await inventoryApi.update(entityId, payload as Parameters<typeof inventoryApi.update>[1]);
      } else if (type === 'DELETE' && entityId) {
        await inventoryApi.delete(entityId);
      }
      break;

    case 'categories':
      if (type === 'CREATE') {
        await categoriesApi.create(payload as Parameters<typeof categoriesApi.create>[0]);
      } else if (type === 'UPDATE' && entityId) {
        await categoriesApi.update(entityId, payload as Parameters<typeof categoriesApi.update>[1]);
      } else if (type === 'DELETE' && entityId) {
        await categoriesApi.delete(entityId);
      }
      break;

    case 'borrowers':
      if (type === 'CREATE') {
        await borrowersApi.create(payload as Parameters<typeof borrowersApi.create>[0]);
      } else if (type === 'UPDATE' && entityId) {
        await borrowersApi.update(entityId, payload as Parameters<typeof borrowersApi.update>[1]);
      } else if (type === 'DELETE' && entityId) {
        await borrowersApi.delete(entityId);
      }
      break;

    default:
      throw new Error(`Unknown entity type: ${entity}`);
  }
}

/**
 * Full sync: push pending mutations, then pull fresh data
 */
export async function fullSync(workspaceId: string): Promise<{
  pushed: { synced: number; failed: number };
}> {
  // First push any pending mutations
  const pushed = await pushMutations(workspaceId);

  // Then pull fresh data
  await pullData(workspaceId);

  return { pushed };
}

/**
 * Get last sync time for an entity
 */
export async function getLastSyncTime(entity: EntityType, workspaceId: string): Promise<number | null> {
  const state = await db.syncState.get([entity, workspaceId]);
  return state?.lastSyncAt ?? null;
}

/**
 * Check if data is stale (older than threshold)
 */
export async function isDataStale(
  entity: EntityType,
  workspaceId: string,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes default
): Promise<boolean> {
  const lastSync = await getLastSyncTime(entity, workspaceId);
  if (!lastSync) return true;
  return Date.now() - lastSync > maxAgeMs;
}
