import { vi, describe, it, expect, beforeEach } from "vitest";
import * as offlineDb from "@/lib/db/offline-db";
import * as mutationQueue from "@/lib/sync/mutation-queue";
import {
  buildSearchIndices,
  offlineGlobalSearch,
  type SearchIndices,
} from "../offline-search";
import type { Item } from "@/lib/types/items";
import type { Borrower } from "@/lib/types/borrowers";
import type { Container } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";
import type { Category } from "@/lib/api/categories";
import type { MutationQueueEntry } from "@/lib/db/types";

// Mock the dependencies
vi.mock("@/lib/db/offline-db");
vi.mock("@/lib/sync/mutation-queue");

// Helper functions to create test data
function createItem(partial: Partial<Item>): Item {
  return {
    id: partial.id ?? "item-1",
    workspace_id: "ws-1",
    sku: partial.sku ?? "SKU001",
    name: partial.name ?? "Test Item",
    min_stock_level: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

function createBorrower(partial: Partial<Borrower>): Borrower {
  return {
    id: partial.id ?? "borrower-1",
    workspace_id: "ws-1",
    name: partial.name ?? "Test Borrower",
    is_archived: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

function createContainer(partial: Partial<Container>): Container {
  return {
    id: partial.id ?? "container-1",
    workspace_id: "ws-1",
    name: partial.name ?? "Test Container",
    location_id: "loc-1",
    is_archived: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

function createLocation(partial: Partial<Location>): Location {
  return {
    id: partial.id ?? "location-1",
    workspace_id: "ws-1",
    name: partial.name ?? "Test Location",
    is_archived: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

function createCategory(partial: Partial<Category>): Category {
  return {
    id: partial.id ?? "category-1",
    name: partial.name ?? "Test Category",
    parent_category_id: null,
    description: partial.description ?? null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

function createPendingMutation(
  partial: Partial<MutationQueueEntry>
): MutationQueueEntry {
  return {
    id: partial.id ?? 1,
    idempotencyKey: partial.idempotencyKey ?? "key-1",
    operation: partial.operation ?? "create",
    entity: partial.entity ?? "items",
    entityId: partial.entityId,
    payload: partial.payload ?? {},
    timestamp: partial.timestamp ?? Date.now(),
    retries: 0,
    status: "pending",
    ...partial,
  };
}

describe("buildSearchIndices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(offlineDb.getAll).mockResolvedValue([]);
  });

  it("builds indices from IndexedDB data", async () => {
    const items = [createItem({ id: "1", name: "Power Drill" })];
    const borrowers = [createBorrower({ id: "1", name: "John Smith" })];
    const containers = [createContainer({ id: "1", name: "Toolbox" })];
    const locations = [createLocation({ id: "1", name: "Garage" })];
    const categories = [createCategory({ id: "1", name: "Tools" })];

    vi.mocked(offlineDb.getAll).mockImplementation(async (store) => {
      switch (store) {
        case "items":
          return items;
        case "borrowers":
          return borrowers;
        case "containers":
          return containers;
        case "locations":
          return locations;
        case "categories":
          return categories;
        default:
          return [];
      }
    });

    const indices = await buildSearchIndices();

    expect(indices).toBeDefined();
    expect(indices.items).toBeDefined();
    expect(indices.borrowers).toBeDefined();
    expect(indices.containers).toBeDefined();
    expect(indices.locations).toBeDefined();
    expect(indices.categories).toBeDefined();
    expect(indices.lastUpdated).toBeGreaterThan(0);
  });

  it("returns valid SearchIndices with all Fuse instances", async () => {
    vi.mocked(offlineDb.getAll).mockResolvedValue([]);

    const indices = await buildSearchIndices();

    // Check that all Fuse instances have search method
    expect(typeof indices.items.search).toBe("function");
    expect(typeof indices.borrowers.search).toBe("function");
    expect(typeof indices.containers.search).toBe("function");
    expect(typeof indices.locations.search).toBe("function");
    expect(typeof indices.categories.search).toBe("function");
  });

  it("handles empty IndexedDB gracefully", async () => {
    vi.mocked(offlineDb.getAll).mockResolvedValue([]);

    const indices = await buildSearchIndices();

    // Should still return valid indices
    expect(indices).toBeDefined();

    // Search on empty indices should return empty results
    const results = indices.items.search("test");
    expect(results).toEqual([]);
  });
});

describe("offlineGlobalSearch", () => {
  let indices: SearchIndices;

  beforeEach(async () => {
    vi.resetAllMocks();

    // Default: empty mutation queue
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([]);

    // Set up IndexedDB with test data
    vi.mocked(offlineDb.getAll).mockImplementation(async (store) => {
      switch (store) {
        case "items":
          return [
            createItem({ id: "1", name: "Power Drill", sku: "PD001" }),
            createItem({ id: "2", name: "Hammer", sku: "HM001" }),
            createItem({ id: "3", name: "Screwdriver Set", sku: "SD001" }),
          ];
        case "borrowers":
          return [
            createBorrower({
              id: "1",
              name: "John Smith",
              email: "john@example.com",
            }),
            createBorrower({
              id: "2",
              name: "Jane Doe",
              email: "jane@example.com",
            }),
          ];
        case "containers":
          return [
            createContainer({ id: "1", name: "Blue Toolbox", short_code: "TB1" }),
            createContainer({ id: "2", name: "Red Bin", short_code: "RB1" }),
          ];
        case "locations":
          return [
            createLocation({
              id: "1",
              name: "Garage Workshop",
              zone: "North",
            }),
            createLocation({ id: "2", name: "Basement Storage" }),
          ];
        case "categories":
          return [createCategory({ id: "1", name: "Power Tools" })];
        default:
          return [];
      }
    });

    indices = await buildSearchIndices();
  });

  it("returns empty results for empty query", async () => {
    const results = await offlineGlobalSearch(indices, "");

    expect(results.query).toBe("");
    expect(results.totalCount).toBe(0);
    expect(results.results.items).toEqual([]);
    expect(results.results.borrowers).toEqual([]);
    expect(results.results.containers).toEqual([]);
    expect(results.results.locations).toEqual([]);
  });

  it("returns empty results for whitespace-only query", async () => {
    const results = await offlineGlobalSearch(indices, "   ");

    expect(results.query).toBe("");
    expect(results.totalCount).toBe(0);
  });

  it("returns results matching query across entity types", async () => {
    // "Tool" should match items (Screwdriver, Power Drill), containers (Toolbox), and categories
    const results = await offlineGlobalSearch(indices, "Tool");

    expect(results.query).toBe("Tool");
    expect(results.totalCount).toBeGreaterThan(0);

    // Check items - should find matches containing "tool"
    expect(results.results.containers.length).toBeGreaterThan(0);
    expect(results.results.containers[0].title).toBe("Blue Toolbox");
  });

  it("limits results per entity type", async () => {
    // Add more items to IndexedDB
    vi.mocked(offlineDb.getAll).mockImplementation(async (store) => {
      if (store === "items") {
        return Array.from({ length: 10 }, (_, i) =>
          createItem({ id: `item-${i}`, name: `Test Item ${i}` })
        );
      }
      return [];
    });

    const indices = await buildSearchIndices();
    const results = await offlineGlobalSearch(indices, "Test", 3);

    expect(results.results.items.length).toBeLessThanOrEqual(3);
  });

  it("fuzzy matching works (typos find items)", async () => {
    // "Powr Dril" should match "Power Drill"
    const results = await offlineGlobalSearch(indices, "Powr Dril");

    expect(results.results.items.length).toBeGreaterThan(0);
    expect(results.results.items[0].title).toBe("Power Drill");
  });

  it("results normalized to SearchResult format", async () => {
    const results = await offlineGlobalSearch(indices, "Drill");

    // Check item result format
    expect(results.results.items[0]).toMatchObject({
      id: "1",
      type: "item",
      title: "Power Drill",
      url: expect.stringContaining("/dashboard/inventory"),
      icon: "Package",
    });
    expect(results.results.items[0].metadata?.sku).toBe("PD001");
  });

  it("borrower results have correct format", async () => {
    const results = await offlineGlobalSearch(indices, "John");

    expect(results.results.borrowers[0]).toMatchObject({
      id: "1",
      type: "borrower",
      title: "John Smith",
      url: expect.stringContaining("/dashboard/borrowers"),
      icon: "User",
    });
    expect(results.results.borrowers[0].metadata?.email).toBe("john@example.com");
  });

  it("container results have correct format", async () => {
    const results = await offlineGlobalSearch(indices, "Toolbox");

    expect(results.results.containers[0]).toMatchObject({
      id: "1",
      type: "container",
      title: "Blue Toolbox",
      url: expect.stringContaining("/dashboard/containers"),
      icon: "Box",
    });
    expect(results.results.containers[0].metadata?.short_code).toBe("TB1");
  });

  it("location results have correct format", async () => {
    const results = await offlineGlobalSearch(indices, "Garage");

    expect(results.results.locations[0]).toMatchObject({
      id: "1",
      type: "location",
      title: "Garage Workshop",
      url: expect.stringContaining("/dashboard/locations"),
      icon: "MapPin",
    });
  });

  it("calculates correct totalCount", async () => {
    const results = await offlineGlobalSearch(indices, "John");

    // Should find John Smith borrower
    const expectedCount =
      results.results.items.length +
      results.results.borrowers.length +
      results.results.containers.length +
      results.results.locations.length;

    expect(results.totalCount).toBe(expectedCount);
  });
});

describe("pending mutations merge", () => {
  let indices: SearchIndices;

  beforeEach(async () => {
    vi.resetAllMocks();

    // Set up empty IndexedDB
    vi.mocked(offlineDb.getAll).mockResolvedValue([]);
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([]);

    indices = await buildSearchIndices();
  });

  it("pending create mutations appear in search results", async () => {
    // Set up pending create mutation for an item
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
      createPendingMutation({
        operation: "create",
        entity: "items",
        payload: {
          id: "pending-item-1",
          name: "New Pending Item",
          sku: "NPI001",
          workspace_id: "ws-1",
        },
      }),
    ]);

    const results = await offlineGlobalSearch(indices, "Pending");

    expect(results.results.items.length).toBeGreaterThan(0);
    expect(results.results.items[0].title).toBe("New Pending Item");
  });

  it("pending items marked with isPending metadata", async () => {
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
      createPendingMutation({
        operation: "create",
        entity: "items",
        payload: {
          id: "pending-item-1",
          name: "Pending Widget",
          workspace_id: "ws-1",
        },
      }),
    ]);

    const results = await offlineGlobalSearch(indices, "Widget");

    expect(results.results.items[0].metadata?.isPending).toBe("true");
  });

  it("duplicate prevention - same ID in IndexedDB and pending queue", async () => {
    // Set up IndexedDB with an item
    vi.mocked(offlineDb.getAll).mockImplementation(async (store) => {
      if (store === "items") {
        return [createItem({ id: "item-1", name: "Test Widget" })];
      }
      return [];
    });

    // Set up pending mutation with same ID (optimistic update already applied)
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
      createPendingMutation({
        operation: "create",
        entity: "items",
        payload: {
          id: "item-1",
          name: "Test Widget",
          workspace_id: "ws-1",
        },
      }),
    ]);

    const indices = await buildSearchIndices();
    const results = await offlineGlobalSearch(indices, "Widget");

    // Should only have one result, not duplicated
    expect(results.results.items.length).toBe(1);
    // Original item from IndexedDB should not have isPending marker
    expect(results.results.items[0].metadata?.isPending).toBeUndefined();
  });

  it("pending borrowers appear in search results", async () => {
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
      createPendingMutation({
        operation: "create",
        entity: "borrowers",
        payload: {
          id: "pending-borrower-1",
          name: "New Borrower Jane",
          email: "jane.new@example.com",
          workspace_id: "ws-1",
        },
      }),
    ]);

    const results = await offlineGlobalSearch(indices, "Jane");

    expect(results.results.borrowers.length).toBeGreaterThan(0);
    expect(results.results.borrowers[0].title).toBe("New Borrower Jane");
    expect(results.results.borrowers[0].metadata?.isPending).toBe("true");
  });

  it("pending containers appear in search results", async () => {
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
      createPendingMutation({
        operation: "create",
        entity: "containers",
        payload: {
          id: "pending-container-1",
          name: "New Storage Container",
          short_code: "NSC1",
          workspace_id: "ws-1",
          location_id: "loc-1",
        },
      }),
    ]);

    const results = await offlineGlobalSearch(indices, "Storage");

    expect(results.results.containers.length).toBeGreaterThan(0);
    expect(results.results.containers[0].title).toBe("New Storage Container");
    expect(results.results.containers[0].metadata?.isPending).toBe("true");
  });

  it("pending locations appear in search results", async () => {
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
      createPendingMutation({
        operation: "create",
        entity: "locations",
        payload: {
          id: "pending-location-1",
          name: "New Attic Space",
          zone: "Upper Floor",
          workspace_id: "ws-1",
        },
      }),
    ]);

    const results = await offlineGlobalSearch(indices, "Attic");

    expect(results.results.locations.length).toBeGreaterThan(0);
    expect(results.results.locations[0].title).toBe("New Attic Space");
    expect(results.results.locations[0].metadata?.isPending).toBe("true");
  });

  it("update operations are not included in pending results", async () => {
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
      createPendingMutation({
        operation: "update",
        entity: "items",
        entityId: "existing-item-1",
        payload: {
          id: "existing-item-1",
          name: "Updated Item Name",
          workspace_id: "ws-1",
        },
      }),
    ]);

    const results = await offlineGlobalSearch(indices, "Updated");

    // Update mutations should not create new search results
    expect(results.results.items.length).toBe(0);
  });

  it("handles mutation queue access failure gracefully", async () => {
    // Set up IndexedDB with data
    vi.mocked(offlineDb.getAll).mockImplementation(async (store) => {
      if (store === "items") {
        return [createItem({ id: "1", name: "Existing Item" })];
      }
      return [];
    });

    // Simulate mutation queue failure
    vi.mocked(mutationQueue.getPendingMutations).mockRejectedValue(
      new Error("IndexedDB error")
    );

    const indices = await buildSearchIndices();
    const results = await offlineGlobalSearch(indices, "Existing");

    // Should still return results from IndexedDB
    expect(results.results.items.length).toBeGreaterThan(0);
    expect(results.results.items[0].title).toBe("Existing Item");
  });

  it("uses idempotencyKey as ID when payload has no ID", async () => {
    const idempotencyKey = "unique-mutation-key-123";
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
      createPendingMutation({
        idempotencyKey,
        operation: "create",
        entity: "items",
        payload: {
          // No id in payload
          name: "Item Without ID",
          workspace_id: "ws-1",
        },
      }),
    ]);

    const results = await offlineGlobalSearch(indices, "Without ID");

    expect(results.results.items.length).toBeGreaterThan(0);
    expect(results.results.items[0].id).toBe(idempotencyKey);
  });
});
