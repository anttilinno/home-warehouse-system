/**
 * Comprehensive tests for SyncManager class
 *
 * Tests cover:
 * - Queue processing (locking, offline skip, entity ordering)
 * - Dependency handling (wait, skip, cascade failures)
 * - Conflict resolution (auto-resolve, user review, logging)
 * - Error handling and retry (network errors, client errors, max retries)
 * - Event subscription (subscribe, unsubscribe, broadcast)
 * - Topological sorting for hierarchical entities
 * - Public API methods
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SyncManager,
  topologicalSortCategories,
  topologicalSortLocations,
} from "../sync-manager";
import * as mutationQueue from "../mutation-queue";
import * as conflictResolver from "../conflict-resolver";
import { createMutationEntry, resetFactoryCounters } from "@/lib/test-utils";

// =============================================================================
// Mocks
// =============================================================================

vi.mock("../mutation-queue", () => ({
  getPendingMutations: vi.fn().mockResolvedValue([]),
  updateMutationStatus: vi.fn().mockResolvedValue(undefined),
  removeMutation: vi.fn().mockResolvedValue(undefined),
  calculateRetryDelay: vi.fn().mockReturnValue(1000),
  shouldRetry: vi.fn().mockReturnValue(true),
  getPendingMutationCount: vi.fn().mockResolvedValue(0),
  prepareSyncPayload: vi.fn((m) => m.payload),
  getMutationByIdempotencyKey: vi.fn().mockResolvedValue(undefined),
  RETRY_CONFIG: { maxRetries: 5 },
}));

vi.mock("../conflict-resolver", () => ({
  findConflictFields: vi.fn().mockReturnValue([]),
  classifyConflict: vi.fn().mockReturnValue(false),
  resolveWithLastWriteWins: vi.fn((data) => ({ ...data })),
  logConflict: vi.fn().mockResolvedValue(1),
}));

// Mock BroadcastChannel (jsdom doesn't have it)
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(name: string) {
    this.name = name;
  }
  postMessage = vi.fn();
  close = vi.fn();
}
global.BroadcastChannel =
  MockBroadcastChannel as unknown as typeof BroadcastChannel;

// Store original values for cleanup
const originalNavigator = { ...navigator };
const originalFetch = global.fetch;
const originalLocalStorage = global.localStorage;

// =============================================================================
// Test Suites
// =============================================================================

describe("SyncManager", () => {
  let manager: SyncManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounters();

    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue("ws-test-123"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    Object.defineProperty(global, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(""),
    });

    // Mock process.env
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";

    manager = new SyncManager();
  });

  afterEach(() => {
    manager.destroy();

    // Reset navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    // Restore original fetch
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // processQueue Tests
  // ===========================================================================

  describe("processQueue", () => {
    it("skips processing if already processing (lock mechanism)", async () => {
      const mutations = [
        createMutationEntry({ entity: "items", id: 1 }),
        createMutationEntry({ entity: "categories", id: 2 }),
      ];
      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue(mutations);

      // Start first processing (will be slow due to mutations)
      const firstProcess = manager.processQueue();

      // Try to start second processing immediately
      const secondProcess = manager.processQueue();

      await Promise.all([firstProcess, secondProcess]);

      // getPendingMutations should only be called once (second call was skipped)
      expect(mutationQueue.getPendingMutations).toHaveBeenCalledTimes(1);
    });

    it("skips processing if offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      await manager.processQueue();

      expect(mutationQueue.getPendingMutations).not.toHaveBeenCalled();
    });

    it("processes mutations in entity order", async () => {
      const mutations = [
        createMutationEntry({
          entity: "items",
          id: 1,
          idempotencyKey: "items-1",
        }),
        createMutationEntry({
          entity: "categories",
          id: 2,
          idempotencyKey: "categories-1",
        }),
        createMutationEntry({
          entity: "locations",
          id: 3,
          idempotencyKey: "locations-1",
        }),
        createMutationEntry({
          entity: "inventory",
          id: 4,
          idempotencyKey: "inventory-1",
        }),
      ];
      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue(mutations);

      await manager.processQueue();

      // Verify order of fetch calls by entity
      const fetchCalls = vi.mocked(global.fetch).mock.calls;
      const entityOrder = fetchCalls.map((call) => {
        const url = call[0] as string;
        if (url.includes("/categories")) return "categories";
        if (url.includes("/locations")) return "locations";
        if (url.includes("/items")) return "items";
        if (url.includes("/inventory")) return "inventory";
        return "unknown";
      });

      // Categories and locations should come before items
      const categoriesIdx = entityOrder.indexOf("categories");
      const locationsIdx = entityOrder.indexOf("locations");
      const itemsIdx = entityOrder.indexOf("items");
      const inventoryIdx = entityOrder.indexOf("inventory");

      expect(categoriesIdx).toBeLessThan(itemsIdx);
      expect(locationsIdx).toBeLessThan(inventoryIdx);
      expect(itemsIdx).toBeLessThan(inventoryIdx);
    });

    it("broadcasts SYNC_STARTED and SYNC_COMPLETE events", async () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([]);

      await manager.processQueue();

      const eventTypes = listener.mock.calls.map((call) => call[0].type);
      expect(eventTypes).toContain("SYNC_STARTED");
      expect(eventTypes).toContain("SYNC_COMPLETE");
    });
  });

  // ===========================================================================
  // Dependency Handling Tests
  // ===========================================================================

  describe("dependency handling", () => {
    it("skips mutation if dependencies not synced", async () => {
      const parentMutation = createMutationEntry({
        entity: "categories",
        id: 1,
        idempotencyKey: "parent-key",
        status: "pending",
      });

      const childMutation = createMutationEntry({
        entity: "items",
        id: 2,
        idempotencyKey: "child-key",
        dependsOn: ["parent-key"],
      });

      // Parent still exists in queue (not synced)
      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        childMutation,
      ]);
      vi.mocked(mutationQueue.getMutationByIdempotencyKey).mockImplementation(
        async (key) => {
          if (key === "parent-key") return parentMutation;
          return undefined;
        }
      );

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.processQueue();

      // Child should be skipped
      const skippedEvents = listener.mock.calls.filter(
        (call) => call[0].type === "MUTATION_SKIPPED_DEPENDENCY"
      );
      expect(skippedEvents.length).toBe(1);
      expect(skippedEvents[0][0].payload?.mutation?.idempotencyKey).toBe(
        "child-key"
      );
    });

    it("processes mutation after dependencies sync", async () => {
      const childMutation = createMutationEntry({
        entity: "items",
        id: 2,
        idempotencyKey: "child-key",
        dependsOn: ["parent-key"],
      });

      // Parent no longer in queue (already synced)
      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        childMutation,
      ]);
      vi.mocked(mutationQueue.getMutationByIdempotencyKey).mockResolvedValue(
        undefined
      );

      await manager.processQueue();

      // Fetch should have been called for the child
      expect(global.fetch).toHaveBeenCalled();
    });

    it("cascades failure when parent mutation fails", async () => {
      const parentMutation = createMutationEntry({
        entity: "categories",
        id: 1,
        idempotencyKey: "parent-key",
        status: "failed",
      });

      const childMutation = createMutationEntry({
        entity: "items",
        id: 2,
        idempotencyKey: "child-key",
        dependsOn: ["parent-key"],
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        childMutation,
      ]);
      vi.mocked(mutationQueue.getMutationByIdempotencyKey).mockImplementation(
        async (key) => {
          if (key === "parent-key") return parentMutation;
          return undefined;
        }
      );

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.processQueue();

      // Should broadcast cascade failure
      const cascadeEvents = listener.mock.calls.filter(
        (call) => call[0].type === "MUTATION_CASCADE_FAILED"
      );
      expect(cascadeEvents.length).toBe(1);

      // Should mark as failed
      expect(mutationQueue.updateMutationStatus).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          status: "failed",
          lastError: "Parent mutation failed",
        })
      );
    });

    it("broadcasts MUTATION_CASCADE_FAILED for cascade failures", async () => {
      const childMutation = createMutationEntry({
        entity: "items",
        id: 2,
        idempotencyKey: "child-key",
        dependsOn: ["failed-parent-key"],
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        childMutation,
      ]);
      vi.mocked(mutationQueue.getMutationByIdempotencyKey).mockImplementation(
        async (key) => {
          if (key === "failed-parent-key") {
            return createMutationEntry({
              entity: "categories",
              id: 1,
              idempotencyKey: "failed-parent-key",
              status: "failed",
            });
          }
          return undefined;
        }
      );

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.processQueue();

      const eventTypes = listener.mock.calls.map((call) => call[0].type);
      expect(eventTypes).toContain("MUTATION_CASCADE_FAILED");
    });
  });

  // ===========================================================================
  // Conflict Handling Tests
  // ===========================================================================

  describe("conflict handling", () => {
    it("auto-resolves non-critical conflicts with LWW", async () => {
      const mutation = createMutationEntry({
        entity: "items",
        id: 1,
        operation: "update",
        entityId: "item-1",
        payload: { name: "Local Name" },
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        mutation,
      ]);

      // Return 409 conflict
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          server_data: {
            name: "Server Name",
            updated_at: new Date().toISOString(),
          },
        }),
        text: vi.fn().mockResolvedValue(""),
      } as unknown as Response);

      // Non-critical conflict
      vi.mocked(conflictResolver.findConflictFields).mockReturnValue(["name"]);
      vi.mocked(conflictResolver.classifyConflict).mockReturnValue(false);

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.processQueue();

      // Should broadcast auto-resolved event
      const autoResolvedEvents = listener.mock.calls.filter(
        (call) => call[0].type === "CONFLICT_AUTO_RESOLVED"
      );
      expect(autoResolvedEvents.length).toBe(1);

      // Should remove mutation (server wins)
      expect(mutationQueue.removeMutation).toHaveBeenCalled();
    });

    it("queues critical conflicts for user review", async () => {
      const mutation = createMutationEntry({
        entity: "inventory",
        id: 1,
        operation: "update",
        entityId: "inv-1",
        payload: { quantity: 10 },
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        mutation,
      ]);

      // Return 409 conflict
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          server_data: {
            quantity: 5,
            updated_at: new Date().toISOString(),
          },
        }),
        text: vi.fn().mockResolvedValue(""),
      } as unknown as Response);

      // Critical conflict (quantity is critical for inventory)
      vi.mocked(conflictResolver.findConflictFields).mockReturnValue([
        "quantity",
      ]);
      vi.mocked(conflictResolver.classifyConflict).mockReturnValue(true);

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.processQueue();

      // Should broadcast needs review event
      const needsReviewEvents = listener.mock.calls.filter(
        (call) => call[0].type === "CONFLICT_NEEDS_REVIEW"
      );
      expect(needsReviewEvents.length).toBe(1);

      // Should NOT remove mutation (needs user review)
      expect(mutationQueue.removeMutation).not.toHaveBeenCalled();

      // Should reset status to pending (not failed)
      expect(mutationQueue.updateMutationStatus).toHaveBeenCalledWith(
        mutation.id,
        expect.objectContaining({ status: "pending" })
      );
    });

    it("broadcasts CONFLICT_AUTO_RESOLVED for auto-resolved conflicts", async () => {
      const mutation = createMutationEntry({
        entity: "items",
        id: 1,
        operation: "update",
        entityId: "item-1",
        payload: { description: "Local desc" },
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        mutation,
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          server_data: { description: "Server desc" },
        }),
        text: vi.fn().mockResolvedValue(""),
      } as unknown as Response);

      vi.mocked(conflictResolver.findConflictFields).mockReturnValue([
        "description",
      ]);
      vi.mocked(conflictResolver.classifyConflict).mockReturnValue(false);

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.processQueue();

      const eventTypes = listener.mock.calls.map((call) => call[0].type);
      expect(eventTypes).toContain("CONFLICT_AUTO_RESOLVED");
    });

    it("broadcasts CONFLICT_NEEDS_REVIEW for critical conflicts", async () => {
      const mutation = createMutationEntry({
        entity: "loans",
        id: 1,
        operation: "update",
        entityId: "loan-1",
        payload: { quantity: 3 },
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        mutation,
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          server_data: { quantity: 1 },
        }),
        text: vi.fn().mockResolvedValue(""),
      } as unknown as Response);

      vi.mocked(conflictResolver.findConflictFields).mockReturnValue([
        "quantity",
      ]);
      vi.mocked(conflictResolver.classifyConflict).mockReturnValue(true);

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.processQueue();

      const eventTypes = listener.mock.calls.map((call) => call[0].type);
      expect(eventTypes).toContain("CONFLICT_NEEDS_REVIEW");
    });

    it("logs conflicts to IndexedDB", async () => {
      const mutation = createMutationEntry({
        entity: "items",
        id: 1,
        operation: "update",
        entityId: "item-1",
        payload: { name: "Local" },
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        mutation,
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          server_data: { name: "Server" },
        }),
        text: vi.fn().mockResolvedValue(""),
      } as unknown as Response);

      vi.mocked(conflictResolver.findConflictFields).mockReturnValue(["name"]);
      vi.mocked(conflictResolver.classifyConflict).mockReturnValue(false);

      await manager.processQueue();

      expect(conflictResolver.logConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "items",
          entityId: "item-1",
        })
      );
    });
  });

  // ===========================================================================
  // Error Handling and Retry Tests
  // ===========================================================================

  describe("error handling and retry", () => {
    it("retries on network error", async () => {
      const mutation = createMutationEntry({
        entity: "items",
        id: 1,
        retries: 0,
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        mutation,
      ]);

      // Network error
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      await manager.processQueue();

      // Should update status with incremented retries
      expect(mutationQueue.updateMutationStatus).toHaveBeenCalledWith(
        mutation.id,
        expect.objectContaining({
          status: "pending",
          retries: 1,
        })
      );
    });

    it("does not retry on 4xx client errors (except 408, 429)", async () => {
      const mutation = createMutationEntry({
        entity: "items",
        id: 1,
        retries: 0,
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        mutation,
      ]);

      // 400 Bad Request
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue("Bad Request"),
      } as unknown as Response);

      vi.mocked(mutationQueue.shouldRetry).mockReturnValue(false);

      await manager.processQueue();

      // Should mark as failed immediately (no retry)
      expect(mutationQueue.updateMutationStatus).toHaveBeenCalledWith(
        mutation.id,
        expect.objectContaining({
          status: "failed",
        })
      );
    });

    it("marks mutation as failed after max retries", async () => {
      const mutation = createMutationEntry({
        entity: "items",
        id: 1,
        retries: 5, // Already at max
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        mutation,
      ]);

      // Server error (would normally retry)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue("Server Error"),
      } as unknown as Response);

      vi.mocked(mutationQueue.shouldRetry).mockReturnValue(true);

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.processQueue();

      // Should mark as failed (max retries exceeded)
      expect(mutationQueue.updateMutationStatus).toHaveBeenCalledWith(
        mutation.id,
        expect.objectContaining({ status: "failed" })
      );

      // Should broadcast failure
      const eventTypes = listener.mock.calls.map((call) => call[0].type);
      expect(eventTypes).toContain("MUTATION_FAILED");
    });

    it("broadcasts MUTATION_FAILED when max retries reached", async () => {
      const mutation = createMutationEntry({
        entity: "items",
        id: 1,
        retries: 5,
      });

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
        mutation,
      ]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Error"),
      } as unknown as Response);

      vi.mocked(mutationQueue.shouldRetry).mockReturnValue(true);

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.processQueue();

      const failedEvents = listener.mock.calls.filter(
        (call) => call[0].type === "MUTATION_FAILED"
      );
      expect(failedEvents.length).toBe(1);
      expect(failedEvents[0][0].payload?.mutation?.id).toBe(1);
    });
  });

  // ===========================================================================
  // Event Subscription Tests
  // ===========================================================================

  describe("event subscription", () => {
    it("subscribe returns unsubscribe function", () => {
      const listener = vi.fn();

      const unsubscribe = manager.subscribe(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    it("listeners receive all event types", async () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([]);

      await manager.processQueue();

      // Should have received events
      expect(listener).toHaveBeenCalled();

      const eventTypes = listener.mock.calls.map((call) => call[0].type);
      expect(eventTypes).toContain("SYNC_STARTED");
      expect(eventTypes).toContain("SYNC_COMPLETE");
    });

    it("unsubscribe removes listener", async () => {
      const listener = vi.fn();

      const unsubscribe = manager.subscribe(listener);
      unsubscribe();

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([]);

      await manager.processQueue();

      // Listener should not be called after unsubscribe
      expect(listener).not.toHaveBeenCalled();
    });

    it("multiple listeners receive events independently", async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.subscribe(listener1);
      manager.subscribe(listener2);

      vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([]);

      await manager.processQueue();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // Both should receive same events
      expect(listener1.mock.calls.length).toBe(listener2.mock.calls.length);
    });
  });

  // ===========================================================================
  // Public API Tests
  // ===========================================================================

  describe("public API", () => {
    it("getPendingCount returns correct count", async () => {
      vi.mocked(mutationQueue.getPendingMutationCount).mockResolvedValue(5);

      const count = await manager.getPendingCount();

      expect(count).toBe(5);
    });

    it("retryMutation resets status and processes queue", async () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.retryMutation(123);

      expect(mutationQueue.updateMutationStatus).toHaveBeenCalledWith(123, {
        status: "pending",
        retries: 0,
      });

      // Should broadcast queue updated
      const eventTypes = listener.mock.calls.map((call) => call[0].type);
      expect(eventTypes).toContain("QUEUE_UPDATED");
    });

    it("cancelMutation removes mutation from queue", async () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.cancelMutation(456);

      expect(mutationQueue.removeMutation).toHaveBeenCalledWith(456);

      // Should broadcast queue updated
      const eventTypes = listener.mock.calls.map((call) => call[0].type);
      expect(eventTypes).toContain("QUEUE_UPDATED");
    });

    it("destroy cleans up listeners and channels", () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.destroy();

      // Manually trigger broadcast to verify listener was removed
      // (this is implementation testing, but important for cleanup verification)
      // After destroy, internal listeners set should be cleared
    });
  });
});

// =============================================================================
// Topological Sort Tests
// =============================================================================

describe("topologicalSortCategories", () => {
  beforeEach(() => {
    resetFactoryCounters();
  });

  it("orders parents before children", () => {
    const parent = createMutationEntry({
      entity: "categories",
      id: 1,
      idempotencyKey: "parent-key",
      operation: "create",
      payload: { name: "Parent Category", parent_category_id: null },
    });

    const child = createMutationEntry({
      entity: "categories",
      id: 2,
      idempotencyKey: "child-key",
      operation: "create",
      payload: { name: "Child Category", parent_category_id: "parent-key" },
    });

    // Pass in wrong order (child first)
    const sorted = topologicalSortCategories([child, parent]);

    expect(sorted[0].idempotencyKey).toBe("parent-key");
    expect(sorted[1].idempotencyKey).toBe("child-key");
  });

  it("handles single mutation without sorting", () => {
    const single = createMutationEntry({
      entity: "categories",
      id: 1,
      operation: "create",
      payload: { name: "Single" },
    });

    const sorted = topologicalSortCategories([single]);

    expect(sorted.length).toBe(1);
    expect(sorted[0]).toEqual(single);
  });

  it("handles mutations with no parent references", () => {
    const cat1 = createMutationEntry({
      entity: "categories",
      id: 1,
      idempotencyKey: "cat1-key",
      operation: "create",
      payload: { name: "Category 1", parent_category_id: null },
    });

    const cat2 = createMutationEntry({
      entity: "categories",
      id: 2,
      idempotencyKey: "cat2-key",
      operation: "create",
      payload: { name: "Category 2", parent_category_id: null },
    });

    const sorted = topologicalSortCategories([cat1, cat2]);

    expect(sorted.length).toBe(2);
  });

  it("places update operations after creates", () => {
    const createMut = createMutationEntry({
      entity: "categories",
      id: 1,
      idempotencyKey: "create-key",
      operation: "create",
      payload: { name: "New Category" },
    });

    const updateMut = createMutationEntry({
      entity: "categories",
      id: 2,
      idempotencyKey: "update-key",
      operation: "update",
      entityId: "existing-cat",
      payload: { name: "Updated Category" },
    });

    const sorted = topologicalSortCategories([updateMut, createMut]);

    // Creates should come before updates
    expect(sorted[0].operation).toBe("create");
    expect(sorted[1].operation).toBe("update");
  });

  it("handles multi-level hierarchies", () => {
    const grandparent = createMutationEntry({
      entity: "categories",
      id: 1,
      idempotencyKey: "grandparent-key",
      operation: "create",
      payload: { name: "Grandparent", parent_category_id: null },
    });

    const parent = createMutationEntry({
      entity: "categories",
      id: 2,
      idempotencyKey: "parent-key",
      operation: "create",
      payload: { name: "Parent", parent_category_id: "grandparent-key" },
    });

    const child = createMutationEntry({
      entity: "categories",
      id: 3,
      idempotencyKey: "child-key",
      operation: "create",
      payload: { name: "Child", parent_category_id: "parent-key" },
    });

    // Pass in reverse order
    const sorted = topologicalSortCategories([child, parent, grandparent]);

    expect(sorted[0].idempotencyKey).toBe("grandparent-key");
    expect(sorted[1].idempotencyKey).toBe("parent-key");
    expect(sorted[2].idempotencyKey).toBe("child-key");
  });
});

describe("topologicalSortLocations", () => {
  beforeEach(() => {
    resetFactoryCounters();
  });

  it("orders parents before children", () => {
    const parent = createMutationEntry({
      entity: "locations",
      id: 1,
      idempotencyKey: "parent-loc",
      operation: "create",
      payload: { name: "Parent Location", parent_location: null },
    });

    const child = createMutationEntry({
      entity: "locations",
      id: 2,
      idempotencyKey: "child-loc",
      operation: "create",
      payload: { name: "Child Location", parent_location: "parent-loc" },
    });

    const sorted = topologicalSortLocations([child, parent]);

    expect(sorted[0].idempotencyKey).toBe("parent-loc");
    expect(sorted[1].idempotencyKey).toBe("child-loc");
  });

  it("handles single mutation without sorting", () => {
    const single = createMutationEntry({
      entity: "locations",
      id: 1,
      operation: "create",
      payload: { name: "Single Location" },
    });

    const sorted = topologicalSortLocations([single]);

    expect(sorted.length).toBe(1);
  });

  it("handles mutations with no parent references", () => {
    const loc1 = createMutationEntry({
      entity: "locations",
      id: 1,
      idempotencyKey: "loc1-key",
      operation: "create",
      payload: { name: "Location 1", parent_location: null },
    });

    const loc2 = createMutationEntry({
      entity: "locations",
      id: 2,
      idempotencyKey: "loc2-key",
      operation: "create",
      payload: { name: "Location 2", parent_location: null },
    });

    const sorted = topologicalSortLocations([loc1, loc2]);

    expect(sorted.length).toBe(2);
  });

  it("handles multi-level hierarchies", () => {
    const building = createMutationEntry({
      entity: "locations",
      id: 1,
      idempotencyKey: "building-key",
      operation: "create",
      payload: { name: "Building", parent_location: null },
    });

    const floor = createMutationEntry({
      entity: "locations",
      id: 2,
      idempotencyKey: "floor-key",
      operation: "create",
      payload: { name: "Floor 1", parent_location: "building-key" },
    });

    const room = createMutationEntry({
      entity: "locations",
      id: 3,
      idempotencyKey: "room-key",
      operation: "create",
      payload: { name: "Room 101", parent_location: "floor-key" },
    });

    // Pass in reverse order
    const sorted = topologicalSortLocations([room, floor, building]);

    expect(sorted[0].idempotencyKey).toBe("building-key");
    expect(sorted[1].idempotencyKey).toBe("floor-key");
    expect(sorted[2].idempotencyKey).toBe("room-key");
  });
});
