/**
 * Entity Factory Functions for Unit Testing
 *
 * Provides typed factory functions for creating test entities with sensible defaults.
 * Extracted from offline-search.test.ts patterns for reuse across test suites.
 */

import type { Item } from "@/lib/types/items";
import type { Location } from "@/lib/types/locations";
import type { Container } from "@/lib/types/containers";
import type { Borrower } from "@/lib/types/borrowers";
import type { Category } from "@/lib/api/categories";
import type { MutationQueueEntry } from "@/lib/db/types";

let idCounter = 0;

/**
 * Reset factory counters between test runs.
 * Call in beforeEach or afterEach hooks.
 */
export function resetFactoryCounters() {
  idCounter = 0;
}

/**
 * Create a test Item with sensible defaults.
 * All required fields are populated; optional fields can be overridden.
 */
export function createItem(partial: Partial<Item> = {}): Item {
  const id = partial.id ?? `item-${++idCounter}`;
  return {
    id,
    workspace_id: "ws-test",
    sku: partial.sku ?? `SKU-${idCounter}`,
    name: partial.name ?? `Test Item ${idCounter}`,
    min_stock_level: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Create a test Location with sensible defaults.
 */
export function createLocation(partial: Partial<Location> = {}): Location {
  const id = partial.id ?? `location-${++idCounter}`;
  return {
    id,
    workspace_id: "ws-test",
    name: partial.name ?? `Test Location ${idCounter}`,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Create a test Container with sensible defaults.
 */
export function createContainer(partial: Partial<Container> = {}): Container {
  const id = partial.id ?? `container-${++idCounter}`;
  return {
    id,
    workspace_id: "ws-test",
    name: partial.name ?? `Test Container ${idCounter}`,
    location_id: partial.location_id ?? "location-1",
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Create a test Borrower with sensible defaults.
 */
export function createBorrower(partial: Partial<Borrower> = {}): Borrower {
  const id = partial.id ?? `borrower-${++idCounter}`;
  return {
    id,
    workspace_id: "ws-test",
    name: partial.name ?? `Test Borrower ${idCounter}`,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Create a test Category with sensible defaults.
 */
export function createCategory(partial: Partial<Category> = {}): Category {
  const id = partial.id ?? `category-${++idCounter}`;
  return {
    id,
    name: partial.name ?? `Test Category ${idCounter}`,
    parent_category_id: null,
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Create a test MutationQueueEntry for sync testing.
 */
export function createMutationEntry(
  partial: Partial<MutationQueueEntry> = {}
): MutationQueueEntry {
  const id = partial.id ?? ++idCounter;
  return {
    id,
    idempotencyKey: partial.idempotencyKey ?? `key-${id}`,
    operation: partial.operation ?? "create",
    entity: partial.entity ?? "items",
    entityId: partial.entityId,
    payload: partial.payload ?? {},
    timestamp: partial.timestamp ?? Date.now(),
    retries: partial.retries ?? 0,
    status: partial.status ?? "pending",
    ...partial,
  };
}
