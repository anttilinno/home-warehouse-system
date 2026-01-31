/**
 * Offline Database Types
 *
 * TypeScript interfaces for IndexedDB storage. Re-exports existing API types
 * where possible to maintain consistency between online and offline data.
 */

import type { DBSchema } from "idb";

// Re-export existing types as Offline types for clarity
export type { Item as OfflineItem } from "@/lib/types/items";
export type { Inventory as OfflineInventory } from "@/lib/types/inventory";
export type { Location as OfflineLocation } from "@/lib/types/locations";
export type { Container as OfflineContainer } from "@/lib/types/containers";
export type { Borrower as OfflineBorrower } from "@/lib/types/borrowers";
export type { Loan as OfflineLoan } from "@/lib/types/loans";
export type { Category as OfflineCategory } from "@/lib/api/categories";

// Import the actual types for use in schema definition
import type { Item } from "@/lib/types/items";
import type { Inventory } from "@/lib/types/inventory";
import type { Location } from "@/lib/types/locations";
import type { Container } from "@/lib/types/containers";
import type { Borrower } from "@/lib/types/borrowers";
import type { Loan } from "@/lib/types/loans";
import type { Category } from "@/lib/api/categories";

/**
 * Sync metadata for tracking synchronization state
 */
export interface SyncMeta {
  /** Key identifier (e.g., "lastSync", "workspaceId") */
  key: string;
  /** The stored value */
  value: string | number | boolean;
  /** Timestamp when this metadata was last updated */
  updatedAt: number;
}

/**
 * Operation types for offline mutations
 */
export type MutationOperation = "create" | "update";

/**
 * Status of a queued mutation
 */
export type MutationStatus = "pending" | "syncing" | "failed";

/**
 * Conflict resolution strategy applied
 */
export type ConflictResolution = "local" | "server" | "merged";

/**
 * Entity types that support offline mutations
 */
export type MutationEntityType =
  | "items"
  | "inventory"
  | "locations"
  | "containers"
  | "categories"
  | "borrowers"
  | "loans";

/**
 * Mutation queue entry for offline operations.
 * Persisted to IndexedDB and replayed when online.
 */
export interface MutationQueueEntry {
  /** Auto-incremented ID (keyPath for IndexedDB) */
  id: number;
  /** UUIDv7 for server-side deduplication */
  idempotencyKey: string;
  /** Type of operation */
  operation: MutationOperation;
  /** Entity type being mutated */
  entity: MutationEntityType;
  /** Entity ID for updates (undefined for creates) */
  entityId?: string;
  /** The mutation payload to send to server */
  payload: Record<string, unknown>;
  /** Timestamp when mutation was queued (ms since epoch) */
  timestamp: number;
  /** Number of retry attempts */
  retries: number;
  /** Last error message if failed */
  lastError?: string;
  /** Current status */
  status: MutationStatus;
  /** Cached updated_at timestamp (ISO string) for conflict detection on updates */
  updatedAt?: string;
  /** Optional array of idempotency keys this mutation depends on */
  dependsOn?: string[];
}

/**
 * Form draft for persisting form data before submission.
 * Enables draft recovery across sessions/reloads.
 */
export interface FormDraft {
  /** Unique identifier for the draft (formType + contextId) */
  id: string;
  /** Type of form (e.g., "item-create", "inventory-edit") */
  formType: string;
  /** Form field values */
  data: Record<string, unknown>;
  /** Timestamp when draft was last saved (ms since epoch) */
  savedAt: number;
}

/**
 * Conflict log entry for tracking sync conflicts.
 * Stored in IndexedDB for user review and debugging.
 */
export interface ConflictLogEntry {
  /** Auto-incremented ID (keyPath for IndexedDB) */
  id: number;
  /** Type of entity that had the conflict */
  entityType: MutationEntityType;
  /** ID of the entity */
  entityId: string;
  /** Local version of the data */
  localData: Record<string, unknown>;
  /** Server version of the data */
  serverData: Record<string, unknown>;
  /** Fields that differed between local and server */
  conflictFields: string[];
  /** How the conflict was resolved */
  resolution: ConflictResolution;
  /** Merged data if resolution was 'merged' */
  resolvedData?: Record<string, unknown>;
  /** Timestamp when conflict was detected (ms since epoch) */
  timestamp: number;
  /** Timestamp when conflict was resolved (ms since epoch) */
  resolvedAt?: number;
}

/**
 * IndexedDB schema definition for the offline database.
 * Extends idb's DBSchema for type-safe database operations.
 */
export interface OfflineDBSchema extends DBSchema {
  items: {
    key: string;
    value: Item;
  };
  inventory: {
    key: string;
    value: Inventory;
  };
  locations: {
    key: string;
    value: Location;
  };
  containers: {
    key: string;
    value: Container;
  };
  categories: {
    key: string;
    value: Category;
  };
  borrowers: {
    key: string;
    value: Borrower;
  };
  loans: {
    key: string;
    value: Loan;
  };
  syncMeta: {
    key: string;
    value: SyncMeta;
  };
  mutationQueue: {
    key: number;
    value: MutationQueueEntry;
    indexes: {
      status: MutationStatus;
      entity: MutationEntityType;
      timestamp: number;
      idempotencyKey: string;
    };
  };
  conflictLog: {
    key: number;
    value: ConflictLogEntry;
    indexes: {
      entityType: MutationEntityType;
      timestamp: number;
      resolution: ConflictResolution;
    };
  };
  formDrafts: {
    key: string;
    value: FormDraft;
  };
}

/**
 * Store names available in the offline database
 */
export type OfflineStoreName = keyof OfflineDBSchema;
