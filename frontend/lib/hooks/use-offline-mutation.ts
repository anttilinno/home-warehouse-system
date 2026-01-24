"use client";

/**
 * Offline Mutation Hook
 *
 * Hook for performing offline-capable mutations with optimistic updates.
 * Queues mutations to IndexedDB before optimistic state updates, writes
 * optimistic data to entity stores, and triggers sync when online.
 */

import { useCallback, useTransition } from "react";
import {
  queueMutation,
  getMutationQueue,
} from "@/lib/sync/mutation-queue";
import { syncManager } from "@/lib/sync/sync-manager";
import type {
  MutationOperation,
  MutationEntityType,
  MutationQueueEntry,
} from "@/lib/db/types";
import { put } from "@/lib/db/offline-db";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for useOfflineMutation hook
 */
export interface UseOfflineMutationOptions<TPayload> {
  /** Entity type being mutated */
  entity: MutationEntityType;
  /** Operation type */
  operation: MutationOperation;
  /**
   * Called after mutation is queued (both online and offline).
   * Use this for optimistic UI updates.
   */
  onMutate?: (payload: TPayload, tempId: string) => void;
  /**
   * Called when mutation succeeds (online sync completed).
   */
  onSuccess?: (data: unknown, payload: TPayload) => void;
  /**
   * Called when mutation fails permanently (after max retries).
   */
  onError?: (error: Error, payload: TPayload) => void;
}

/**
 * Return type for useOfflineMutation
 */
export interface UseOfflineMutationResult<TPayload> {
  /** Queue a mutation. Works online and offline. */
  mutate: (payload: TPayload, entityId?: string) => Promise<string>;
  /** Whether a mutation is currently in progress */
  isPending: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for performing offline-capable mutations with optimistic updates.
 *
 * Flow:
 * 1. Queue mutation to IndexedDB (persist before optimistic update)
 * 2. Call onMutate for optimistic UI update
 * 3. Write optimistic data to entity store for offline reads
 * 4. Trigger immediate sync if online
 *
 * Usage:
 * ```tsx
 * const { mutate, isPending } = useOfflineMutation({
 *   entity: 'items',
 *   operation: 'create',
 *   onMutate: (payload, tempId) => {
 *     addOptimisticItem({ ...payload, id: tempId, _pending: true });
 *   },
 * });
 *
 * async function handleCreate(data: ItemInput) {
 *   const tempId = await mutate(data);
 *   // tempId can be used to track the pending item
 * }
 * ```
 */
export function useOfflineMutation<TPayload extends Record<string, unknown>>({
  entity,
  operation,
  onMutate,
}: UseOfflineMutationOptions<TPayload>): UseOfflineMutationResult<TPayload> {
  const [isPending, startTransition] = useTransition();

  const mutate = useCallback(
    async (payload: TPayload, entityId?: string): Promise<string> => {
      // 1. Queue mutation to IndexedDB FIRST (persist before optimistic update)
      const entry = await queueMutation({
        operation,
        entity,
        entityId,
        payload: payload as Record<string, unknown>,
      });

      const tempId = entry.idempotencyKey;

      // 2. Call onMutate for optimistic UI update
      if (onMutate) {
        startTransition(() => {
          onMutate(payload, tempId);
        });
      }

      // 3. Write to local IndexedDB store for immediate offline access
      if (operation === "create") {
        // For creates, store the optimistic item in the entity store
        try {
          await put(entity, {
            id: tempId,
            ...payload,
            _pending: true, // Mark as pending
          });
        } catch (error) {
          console.warn(
            `[useOfflineMutation] Failed to write optimistic ${entity}:`,
            error
          );
        }
      } else if (operation === "update" && entityId) {
        // For updates, update the existing item in entity store
        try {
          await put(entity, {
            id: entityId,
            ...payload,
            _pending: true,
          });
        } catch (error) {
          console.warn(
            `[useOfflineMutation] Failed to update optimistic ${entity}:`,
            error
          );
        }
      }

      // 4. If online, try to sync immediately
      if (navigator.onLine && syncManager) {
        syncManager.processQueue().catch((error) => {
          console.error("[useOfflineMutation] Immediate sync failed:", error);
        });
      }

      return tempId;
    },
    [entity, operation, onMutate]
  );

  return { mutate, isPending };
}

// ============================================================================
// Pending Mutation Helpers
// ============================================================================

/**
 * Pending marker interface - can be used to identify optimistic items
 */
export interface PendingMutation {
  _pending?: boolean;
}

/**
 * Helper to check if an item is pending sync
 */
export function isPendingMutation(item: unknown): boolean {
  return (
    typeof item === "object" &&
    item !== null &&
    "_pending" in item &&
    item._pending === true
  );
}

// ============================================================================
// Restoration Helpers
// ============================================================================

/**
 * Load pending mutations from IndexedDB for a specific entity.
 * Use this on component mount to restore optimistic state after page refresh.
 *
 * Usage:
 * ```tsx
 * useEffect(() => {
 *   async function restorePending() {
 *     const pending = await getPendingMutationsForEntity('items');
 *     pending.forEach((mutation) => {
 *       if (mutation.operation === 'create') {
 *         addOptimisticItem({
 *           ...mutation.payload,
 *           id: mutation.idempotencyKey,
 *           _pending: true,
 *         });
 *       }
 *     });
 *   }
 *   restorePending();
 * }, []);
 * ```
 */
export async function getPendingMutationsForEntity(
  entity: MutationEntityType
): Promise<MutationQueueEntry[]> {
  const queue = await getMutationQueue();
  return queue.filter((m) => m.entity === entity && m.status !== "failed");
}

/**
 * Get all pending creates for an entity type.
 * Returns the payload with tempId for optimistic rendering.
 */
export async function getPendingCreates<T extends Record<string, unknown>>(
  entity: MutationEntityType
): Promise<Array<T & { id: string; _pending: true }>> {
  const pending = await getPendingMutationsForEntity(entity);
  return pending
    .filter((m) => m.operation === "create")
    .map((m) => ({
      ...(m.payload as T),
      id: m.idempotencyKey,
      _pending: true as const,
    }));
}

/**
 * Get pending updates for an entity type.
 * Returns entity ID with pending payload.
 */
export async function getPendingUpdates<T extends Record<string, unknown>>(
  entity: MutationEntityType
): Promise<Array<{ entityId: string; payload: T }>> {
  const pending = await getPendingMutationsForEntity(entity);
  return pending
    .filter((m) => m.operation === "update" && m.entityId)
    .map((m) => ({
      entityId: m.entityId!,
      payload: m.payload as T,
    }));
}
