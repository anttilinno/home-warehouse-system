import Dexie, { type EntityTable } from 'dexie';
import type {
  Item,
  Location,
  Container,
  Inventory,
  Category,
  Borrower,
} from '@/lib/api';

// Cached versions of entities with sync metadata
export interface CachedItem extends Item {
  _syncedAt: number;
  _workspaceId: string;
}

export interface CachedLocation extends Location {
  _syncedAt: number;
  _workspaceId: string;
}

export interface CachedContainer extends Container {
  _syncedAt: number;
  _workspaceId: string;
}

export interface CachedInventory extends Inventory {
  _syncedAt: number;
  _workspaceId: string;
}

export interface CachedCategory extends Category {
  _syncedAt: number;
  _workspaceId: string;
}

export interface CachedBorrower extends Borrower {
  _syncedAt: number;
  _workspaceId: string;
}

// Pending mutation for offline changes
export type MutationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type EntityType = 'items' | 'locations' | 'containers' | 'inventory' | 'categories' | 'borrowers' | 'loans';

export interface PendingMutation {
  id?: number;
  type: MutationType;
  entity: EntityType;
  entityId?: string; // For UPDATE and DELETE
  payload: unknown;
  workspaceId: string;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

// Sync state tracking
export interface SyncState {
  entity: EntityType;
  workspaceId: string;
  lastSyncAt: number;
}

class HMSDatabase extends Dexie {
  items!: EntityTable<CachedItem, 'id'>;
  locations!: EntityTable<CachedLocation, 'id'>;
  containers!: EntityTable<CachedContainer, 'id'>;
  inventory!: EntityTable<CachedInventory, 'id'>;
  categories!: EntityTable<CachedCategory, 'id'>;
  borrowers!: EntityTable<CachedBorrower, 'id'>;
  pendingMutations!: EntityTable<PendingMutation, 'id'>;
  syncState!: EntityTable<SyncState, 'entity'>;

  constructor() {
    super('hms-offline');

    this.version(1).stores({
      items: 'id, sku, name, _syncedAt, _workspaceId',
      locations: 'id, name, _syncedAt, _workspaceId',
      containers: 'id, name, location_id, _syncedAt, _workspaceId',
      inventory: 'id, item_id, location_id, _syncedAt, _workspaceId',
      categories: 'id, name, parent_category_id, _syncedAt, _workspaceId',
      borrowers: 'id, name, _syncedAt, _workspaceId',
      pendingMutations: '++id, type, entity, createdAt, workspaceId',
      syncState: '[entity+workspaceId], entity, workspaceId, lastSyncAt',
    });
  }
}

// Singleton database instance
export const db = new HMSDatabase();

// Helper to clear all cached data for a workspace
export async function clearWorkspaceCache(workspaceId: string): Promise<void> {
  await Promise.all([
    db.items.where('_workspaceId').equals(workspaceId).delete(),
    db.locations.where('_workspaceId').equals(workspaceId).delete(),
    db.containers.where('_workspaceId').equals(workspaceId).delete(),
    db.inventory.where('_workspaceId').equals(workspaceId).delete(),
    db.categories.where('_workspaceId').equals(workspaceId).delete(),
    db.borrowers.where('_workspaceId').equals(workspaceId).delete(),
    db.syncState.where('workspaceId').equals(workspaceId).delete(),
  ]);
}

// Helper to clear all offline data
export async function clearAllCache(): Promise<void> {
  await Promise.all([
    db.items.clear(),
    db.locations.clear(),
    db.containers.clear(),
    db.inventory.clear(),
    db.categories.clear(),
    db.borrowers.clear(),
    db.pendingMutations.clear(),
    db.syncState.clear(),
  ]);
}

// Get pending mutations count
export async function getPendingMutationsCount(workspaceId?: string): Promise<number> {
  if (workspaceId) {
    return db.pendingMutations.where('workspaceId').equals(workspaceId).count();
  }
  return db.pendingMutations.count();
}
