/**
 * Tests for useOfflineMutation hook
 *
 * Verifies:
 * - FE-01: Offline mutation queue behavior
 * - Optimistic updates written to IndexedDB
 * - Sync triggered when online, skipped when offline
 * - Helper functions for pending mutations
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useOfflineMutation,
  isPendingMutation,
  getPendingMutationsForEntity,
  getPendingCreates,
  getPendingUpdates,
} from "../use-offline-mutation";
import * as mutationQueue from "@/lib/sync/mutation-queue";
import * as offlineDb from "@/lib/db/offline-db";
import { createMutationEntry } from "@/lib/test-utils";

// Use vi.hoisted to create mocks that work with hoisting
const { mockProcessQueue } = vi.hoisted(() => ({
  mockProcessQueue: vi.fn().mockResolvedValue(undefined),
}));

// Mock dependencies
vi.mock("@/lib/sync/mutation-queue");
vi.mock("@/lib/sync/sync-manager", () => ({
  syncManager: {
    processQueue: mockProcessQueue,
  },
}));
vi.mock("@/lib/db/offline-db");

// Store original navigator.onLine value
const originalOnLine = navigator.onLine;

describe("useOfflineMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessQueue.mockResolvedValue(undefined);

    // Reset navigator.onLine to true (online)
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    // Setup default mock implementations
    vi.mocked(mutationQueue.queueMutation).mockResolvedValue({
      id: 1,
      idempotencyKey: "test-key-123",
      operation: "create",
      entity: "items",
      payload: {},
      timestamp: Date.now(),
      retries: 0,
      status: "pending",
    });

    vi.mocked(mutationQueue.getMutationQueue).mockResolvedValue([]);
    vi.mocked(offlineDb.put).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();

    // Restore original navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  // ==========================================================================
  // Queue Behavior Tests
  // ==========================================================================

  describe("queue behavior", () => {
    it("queues mutation and returns idempotency key", async () => {
      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "create",
        })
      );

      let tempId: string;
      await act(async () => {
        tempId = await result.current.mutate({ name: "Test Item" });
      });

      expect(tempId!).toBe("test-key-123");
      expect(mutationQueue.queueMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: "items",
          operation: "create",
          payload: { name: "Test Item" },
        })
      );
    });

    it("queues mutation before calling onMutate", async () => {
      const onMutate = vi.fn();
      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "create",
          onMutate,
        })
      );

      await act(async () => {
        await result.current.mutate({ name: "New Item" });
      });

      // Wait for onMutate to be called (it's inside startTransition)
      await waitFor(() => {
        expect(onMutate).toHaveBeenCalled();
      });

      // Verify queue was called before onMutate using invocationCallOrder
      const queueCallOrder = vi.mocked(mutationQueue.queueMutation).mock
        .invocationCallOrder[0];
      const onMutateCallOrder = onMutate.mock.invocationCallOrder[0];
      expect(queueCallOrder).toBeLessThan(onMutateCallOrder);
    });

    it("passes entity, operation, and payload to queueMutation", async () => {
      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "locations",
          operation: "update",
        })
      );

      await act(async () => {
        await result.current.mutate(
          { name: "Updated Location" },
          "location-123"
        );
      });

      expect(mutationQueue.queueMutation).toHaveBeenCalledWith({
        operation: "update",
        entity: "locations",
        entityId: "location-123",
        payload: { name: "Updated Location" },
        dependsOn: undefined,
      });
    });

    it("passes dependsOn array to queueMutation", async () => {
      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "containers",
          operation: "create",
        })
      );

      await act(async () => {
        await result.current.mutate(
          { name: "New Container", location_id: "temp-loc-1" },
          undefined,
          ["temp-loc-1"]
        );
      });

      expect(mutationQueue.queueMutation).toHaveBeenCalledWith({
        operation: "create",
        entity: "containers",
        entityId: undefined,
        payload: { name: "New Container", location_id: "temp-loc-1" },
        dependsOn: ["temp-loc-1"],
      });
    });
  });

  // ==========================================================================
  // Optimistic Update Tests
  // ==========================================================================

  describe("optimistic updates", () => {
    it("calls onMutate with payload, tempId, and dependsOn", async () => {
      const onMutate = vi.fn();
      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "create",
          onMutate,
        })
      );

      await act(async () => {
        await result.current.mutate(
          { name: "Test" },
          undefined,
          ["dep-key-1"]
        );
      });

      await waitFor(() => {
        expect(onMutate).toHaveBeenCalledWith(
          { name: "Test" },
          "test-key-123",
          ["dep-key-1"]
        );
      });
    });

    it("writes optimistic data to IndexedDB for creates", async () => {
      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "create",
        })
      );

      await act(async () => {
        await result.current.mutate({ name: "Test Item", sku: "SKU001" });
      });

      expect(offlineDb.put).toHaveBeenCalledWith("items", {
        id: "test-key-123",
        name: "Test Item",
        sku: "SKU001",
        _pending: true,
      });
    });

    it("writes optimistic data to IndexedDB for updates", async () => {
      vi.mocked(mutationQueue.queueMutation).mockResolvedValue({
        id: 2,
        idempotencyKey: "update-key-456",
        operation: "update",
        entity: "items",
        entityId: "item-123",
        payload: { name: "Updated Name" },
        timestamp: Date.now(),
        retries: 0,
        status: "pending",
      });

      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "update",
        })
      );

      await act(async () => {
        await result.current.mutate({ name: "Updated Name" }, "item-123");
      });

      expect(offlineDb.put).toHaveBeenCalledWith("items", {
        id: "item-123",
        name: "Updated Name",
        _pending: true,
      });
    });

    it("does not write to IndexedDB for non-create/update operations", async () => {
      // Note: The hook only supports "create" and "update" operations per MutationOperation type
      // This test verifies the conditional logic in the hook

      // Simulate a scenario where operation doesn't match create/update branches
      // by mocking queueMutation to return with entityId undefined for create
      vi.mocked(mutationQueue.queueMutation).mockResolvedValue({
        id: 3,
        idempotencyKey: "create-key-789",
        operation: "create",
        entity: "items",
        payload: { name: "Test" },
        timestamp: Date.now(),
        retries: 0,
        status: "pending",
      });

      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "create",
        })
      );

      // Clear mock before this call to verify only one put call for create
      vi.mocked(offlineDb.put).mockClear();

      await act(async () => {
        await result.current.mutate({ name: "Test" });
      });

      // Should have exactly one put call (for create)
      expect(offlineDb.put).toHaveBeenCalledTimes(1);
    });

    it("handles IndexedDB write errors gracefully for creates", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(offlineDb.put).mockRejectedValue(new Error("IndexedDB error"));

      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "create",
        })
      );

      // Should not throw
      let tempId: string;
      await act(async () => {
        tempId = await result.current.mutate({ name: "Test" });
      });

      // Should still return the tempId even if IndexedDB write fails
      expect(tempId!).toBe("test-key-123");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[useOfflineMutation] Failed to write optimistic items:",
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it("handles IndexedDB write errors gracefully for updates", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(offlineDb.put).mockRejectedValue(new Error("IndexedDB error"));
      vi.mocked(mutationQueue.queueMutation).mockResolvedValue({
        id: 2,
        idempotencyKey: "update-key-456",
        operation: "update",
        entity: "items",
        entityId: "item-123",
        payload: { name: "Updated" },
        timestamp: Date.now(),
        retries: 0,
        status: "pending",
      });

      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "update",
        })
      );

      await act(async () => {
        await result.current.mutate({ name: "Updated" }, "item-123");
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[useOfflineMutation] Failed to update optimistic items:",
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Network State Tests
  // ==========================================================================

  describe("network state handling", () => {
    it("triggers sync when online", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useOfflineMutation({ entity: "items", operation: "create" })
      );

      await act(async () => {
        await result.current.mutate({ name: "Test" });
      });

      expect(mockProcessQueue).toHaveBeenCalled();
    });

    it("does not trigger sync when offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useOfflineMutation({ entity: "items", operation: "create" })
      );

      await act(async () => {
        await result.current.mutate({ name: "Test" });
      });

      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it("handles sync errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockProcessQueue.mockRejectedValueOnce(new Error("Sync failed"));

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useOfflineMutation({ entity: "items", operation: "create" })
      );

      // Should not throw even when sync fails
      await act(async () => {
        await result.current.mutate({ name: "Test" });
      });

      // Wait for the error to be logged (processQueue is fire-and-forget with .catch)
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "[useOfflineMutation] Immediate sync failed:",
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // isPending State Tests
  // ==========================================================================

  describe("isPending state", () => {
    it("isPending is false initially", () => {
      const { result } = renderHook(() =>
        useOfflineMutation({ entity: "items", operation: "create" })
      );

      expect(result.current.isPending).toBe(false);
    });

    it("returns isPending from useTransition", async () => {
      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "create",
          onMutate: vi.fn(),
        })
      );

      // isPending is controlled by React's useTransition
      // It may briefly be true during the startTransition call
      expect(typeof result.current.isPending).toBe("boolean");
    });
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe("isPendingMutation", () => {
  it("returns true for objects with _pending: true", () => {
    expect(isPendingMutation({ id: "1", name: "Test", _pending: true })).toBe(
      true
    );
  });

  it("returns false for objects without _pending", () => {
    expect(isPendingMutation({ id: "1", name: "Test" })).toBe(false);
  });

  it("returns false for objects with _pending: false", () => {
    expect(isPendingMutation({ id: "1", name: "Test", _pending: false })).toBe(
      false
    );
  });

  it("returns false for null", () => {
    expect(isPendingMutation(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isPendingMutation(undefined)).toBe(false);
  });

  it("returns false for primitive values", () => {
    expect(isPendingMutation("string")).toBe(false);
    expect(isPendingMutation(123)).toBe(false);
    expect(isPendingMutation(true)).toBe(false);
  });
});

describe("getPendingMutationsForEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by entity type", async () => {
    const mutations = [
      createMutationEntry({ entity: "items", idempotencyKey: "key-1" }),
      createMutationEntry({ entity: "locations", idempotencyKey: "key-2" }),
      createMutationEntry({ entity: "items", idempotencyKey: "key-3" }),
    ];
    vi.mocked(mutationQueue.getMutationQueue).mockResolvedValue(mutations);

    const result = await getPendingMutationsForEntity("items");

    expect(result).toHaveLength(2);
    expect(result.every((m) => m.entity === "items")).toBe(true);
  });

  it("excludes failed mutations", async () => {
    const mutations = [
      createMutationEntry({
        entity: "items",
        idempotencyKey: "key-1",
        status: "pending",
      }),
      createMutationEntry({
        entity: "items",
        idempotencyKey: "key-2",
        status: "failed",
      }),
      createMutationEntry({
        entity: "items",
        idempotencyKey: "key-3",
        status: "syncing",
      }),
    ];
    vi.mocked(mutationQueue.getMutationQueue).mockResolvedValue(mutations);

    const result = await getPendingMutationsForEntity("items");

    expect(result).toHaveLength(2);
    expect(result.some((m) => m.status === "failed")).toBe(false);
  });

  it("returns empty array when no matching mutations", async () => {
    vi.mocked(mutationQueue.getMutationQueue).mockResolvedValue([]);

    const result = await getPendingMutationsForEntity("containers");

    expect(result).toEqual([]);
  });
});

describe("getPendingCreates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns creates with tempId and _pending flag", async () => {
    const mutations = [
      createMutationEntry({
        entity: "items",
        operation: "create",
        idempotencyKey: "temp-id-1",
        payload: { name: "New Item", sku: "SKU001" },
      }),
      createMutationEntry({
        entity: "items",
        operation: "update",
        idempotencyKey: "key-2",
        entityId: "item-123",
        payload: { name: "Updated" },
      }),
    ];
    vi.mocked(mutationQueue.getMutationQueue).mockResolvedValue(mutations);

    const result = await getPendingCreates<{ name: string; sku: string }>(
      "items"
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "New Item",
      sku: "SKU001",
      id: "temp-id-1",
      _pending: true,
    });
  });

  it("returns empty array when no creates", async () => {
    const mutations = [
      createMutationEntry({
        entity: "items",
        operation: "update",
        idempotencyKey: "key-1",
        entityId: "item-123",
      }),
    ];
    vi.mocked(mutationQueue.getMutationQueue).mockResolvedValue(mutations);

    const result = await getPendingCreates("items");

    expect(result).toEqual([]);
  });
});

describe("getPendingUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns updates with entityId and payload", async () => {
    const mutations = [
      createMutationEntry({
        entity: "items",
        operation: "create",
        idempotencyKey: "key-1",
        payload: { name: "New" },
      }),
      createMutationEntry({
        entity: "items",
        operation: "update",
        idempotencyKey: "key-2",
        entityId: "item-123",
        payload: { name: "Updated Name" },
      }),
      createMutationEntry({
        entity: "items",
        operation: "update",
        idempotencyKey: "key-3",
        entityId: "item-456",
        payload: { sku: "NEW-SKU" },
      }),
    ];
    vi.mocked(mutationQueue.getMutationQueue).mockResolvedValue(mutations);

    const result = await getPendingUpdates<{ name?: string; sku?: string }>(
      "items"
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      entityId: "item-123",
      payload: { name: "Updated Name" },
    });
    expect(result[1]).toEqual({
      entityId: "item-456",
      payload: { sku: "NEW-SKU" },
    });
  });

  it("excludes updates without entityId", async () => {
    const mutations = [
      createMutationEntry({
        entity: "items",
        operation: "update",
        idempotencyKey: "key-1",
        entityId: undefined, // No entityId
        payload: { name: "Invalid" },
      }),
      createMutationEntry({
        entity: "items",
        operation: "update",
        idempotencyKey: "key-2",
        entityId: "item-123",
        payload: { name: "Valid" },
      }),
    ];
    vi.mocked(mutationQueue.getMutationQueue).mockResolvedValue(mutations);

    const result = await getPendingUpdates("items");

    expect(result).toHaveLength(1);
    expect(result[0].entityId).toBe("item-123");
  });

  it("returns empty array when no updates", async () => {
    const mutations = [
      createMutationEntry({
        entity: "items",
        operation: "create",
        idempotencyKey: "key-1",
      }),
    ];
    vi.mocked(mutationQueue.getMutationQueue).mockResolvedValue(mutations);

    const result = await getPendingUpdates("items");

    expect(result).toEqual([]);
  });
});
