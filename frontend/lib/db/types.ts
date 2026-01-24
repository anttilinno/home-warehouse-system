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
}

/**
 * Store names available in the offline database
 */
export type OfflineStoreName = keyof OfflineDBSchema;
