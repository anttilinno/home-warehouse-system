/**
 * Sync and Mutation Queue Mocking Utilities
 *
 * Utilities for mocking sync-related state in unit tests.
 * Provides helpers for mocking pending mutations and sync manager behavior.
 */

import { vi } from "vitest";
import type { MutationQueueEntry } from "@/lib/db/types";

let pendingMutationsStore: MutationQueueEntry[] = [];

/**
 * Set up pending mutations for tests.
 * Use with getPendingMutationsMockImpl to mock mutation-queue behavior.
 *
 * @example
 * ```ts
 * mockPendingMutations([
 *   createMutationEntry({ entity: "items", operation: "create" }),
 * ]);
 * ```
 */
export function mockPendingMutations(mutations: MutationQueueEntry[]) {
  pendingMutationsStore = mutations;
}

/**
 * Get the mock implementation for mutation-queue.getPendingMutations.
 * Returns the mutations set via mockPendingMutations.
 *
 * @example
 * ```ts
 * vi.mocked(mutationQueue.getPendingMutations).mockImplementation(
 *   getPendingMutationsMockImpl()
 * );
 * ```
 */
export function getPendingMutationsMockImpl() {
  return async () => pendingMutationsStore;
}

/**
 * Create a mock sync manager with controllable behavior.
 * Returns an object with mocked methods that can be asserted against.
 *
 * @example
 * ```ts
 * const syncManager = createMockSyncManager();
 * syncManager.sync.mockResolvedValue({ success: false, synced: 0, failed: 1 });
 * ```
 */
export function createMockSyncManager() {
  return {
    sync: vi.fn().mockResolvedValue({ success: true, synced: 0, failed: 0 }),
    getStatus: vi.fn().mockReturnValue({ pending: 0, syncing: false }),
    subscribe: vi.fn().mockReturnValue(() => {}),
    processMutation: vi.fn().mockResolvedValue({ success: true }),
  };
}

// Alias for consistency with function naming in plan
export const mockSyncManager = createMockSyncManager;

/**
 * Reset all sync mocks to initial state.
 * Call in afterEach hooks to clean up between tests.
 */
export function resetSyncMocks() {
  pendingMutationsStore = [];
}
