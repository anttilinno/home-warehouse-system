/**
 * Unit tests for entity-ordered sync processing in SyncManager.
 *
 * Tests verify:
 * - ENTITY_SYNC_ORDER constant has correct dependency order
 * - All mutation entity types are included
 * - MutationQueueEntry type supports optional dependsOn field
 */

import { describe, it, expect } from "vitest";
import { ENTITY_SYNC_ORDER } from "../sync-manager";
import type { MutationQueueEntry, MutationEntityType } from "@/lib/db/types";

describe("ENTITY_SYNC_ORDER", () => {
  it("has correct dependency order (parents before children)", () => {
    const order = ENTITY_SYNC_ORDER;

    // Categories have no dependencies, should be first
    expect(order.indexOf("categories")).toBeLessThan(order.indexOf("items"));

    // Locations should come before containers (containers depend on locations)
    expect(order.indexOf("locations")).toBeLessThan(
      order.indexOf("containers")
    );

    // Borrowers have no dependencies and should come before loans
    expect(order.indexOf("borrowers")).toBeLessThan(order.indexOf("loans"));

    // Containers should come before inventory (inventory can be in containers)
    expect(order.indexOf("containers")).toBeLessThan(
      order.indexOf("inventory")
    );

    // Items should come before inventory (inventory references items)
    expect(order.indexOf("items")).toBeLessThan(order.indexOf("inventory"));

    // Inventory should come before loans (loans reference inventory)
    expect(order.indexOf("inventory")).toBeLessThan(order.indexOf("loans"));
  });

  it("includes all mutation entity types", () => {
    const expectedTypes: MutationEntityType[] = [
      "categories",
      "locations",
      "borrowers",
      "containers",
      "items",
      "inventory",
      "loans",
    ];

    // Check all expected types are present
    for (const type of expectedTypes) {
      expect(ENTITY_SYNC_ORDER).toContain(type);
    }

    // Check no extra types
    expect(ENTITY_SYNC_ORDER.length).toBe(expectedTypes.length);
  });

  it("has no duplicate entity types", () => {
    const unique = new Set(ENTITY_SYNC_ORDER);
    expect(unique.size).toBe(ENTITY_SYNC_ORDER.length);
  });
});

describe("MutationQueueEntry type", () => {
  it("supports optional dependsOn field", () => {
    // This is a compile-time test - if it compiles, the type is correct
    const entryWithDeps: MutationQueueEntry = {
      id: 1,
      idempotencyKey: "test-key-1",
      operation: "create",
      entity: "items",
      payload: { name: "Test Item" },
      timestamp: Date.now(),
      retries: 0,
      status: "pending",
      dependsOn: ["parent-key-1", "parent-key-2"],
    };

    expect(entryWithDeps.dependsOn).toEqual(["parent-key-1", "parent-key-2"]);
  });

  it("allows dependsOn to be undefined", () => {
    const entryWithoutDeps: MutationQueueEntry = {
      id: 2,
      idempotencyKey: "test-key-2",
      operation: "update",
      entity: "locations",
      entityId: "loc-123",
      payload: { name: "Updated Location" },
      timestamp: Date.now(),
      retries: 0,
      status: "pending",
      // No dependsOn field
    };

    expect(entryWithoutDeps.dependsOn).toBeUndefined();
  });

  it("allows dependsOn to be an empty array", () => {
    const entryWithEmptyDeps: MutationQueueEntry = {
      id: 3,
      idempotencyKey: "test-key-3",
      operation: "create",
      entity: "categories",
      payload: { name: "New Category" },
      timestamp: Date.now(),
      retries: 0,
      status: "pending",
      dependsOn: [],
    };

    expect(entryWithEmptyDeps.dependsOn).toEqual([]);
  });
});
