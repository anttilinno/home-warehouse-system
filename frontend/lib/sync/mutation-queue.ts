/**
 * Mutation Queue Module
 *
 * Manages offline mutations stored in IndexedDB. Provides queue operations
 * for adding, updating, and removing mutations, plus retry logic with
 * exponential backoff.
 */

import { v7 as uuidv7 } from "uuid";
import { getDB } from "@/lib/db/offline-db";
import type {
  MutationQueueEntry,
  MutationOperation,
  MutationEntityType,
  MutationStatus,
} from "@/lib/db/types";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Retry configuration for failed mutations
 */
export const RETRY_CONFIG = {
  /** Initial delay before first retry (1 second) */
  initialDelay: 1000,
  /** Maximum delay between retries (30 seconds) */
  maxDelay: 30000,
  /** Maximum number of retry attempts */
  maxRetries: 5,
  /** Exponential backoff factor */
  factor: 2,
  /** Add jitter to prevent thundering herd */
  jitter: true,
} as const;

/**
 * Time-to-live for mutations (7 days in milliseconds)
 */
export const MUTATION_TTL = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// BroadcastChannel for Queue Updates
// ============================================================================

/**
 * BroadcastChannel for notifying other tabs/contexts of queue changes.
 * Only created in browser environment where BroadcastChannel is available.
 */
const queueChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("sync-status")
    : null;

/**
 * Broadcast queue update event to all listeners.
 * Called after queue operations that change the pending count.
 */
export function broadcastQueueUpdate(): void {
  if (!queueChannel) return;

  // Get pending count and broadcast asynchronously
  getPendingMutationCount()
    .then((count) => {
      queueChannel.postMessage({
        type: "QUEUE_UPDATED",
        payload: { queueLength: count },
      });
    })
    .catch((error) => {
      console.warn("[MutationQueue] Failed to broadcast queue update:", error);
    });
}

// ============================================================================
// Queue Operations
// ============================================================================

/**
 * Parameters for queuing a new mutation
 */
export interface QueueMutationParams {
  operation: MutationOperation;
  entity: MutationEntityType;
  entityId?: string;
  payload: Record<string, unknown>;
  /** Cached updated_at timestamp from entity (for conflict detection on updates) */
  cachedUpdatedAt?: string;
}

/**
 * Queue a new mutation for offline sync.
 * Generates a UUIDv7 idempotency key for server-side deduplication.
 *
 * @param params - The mutation parameters
 * @returns The created mutation entry with generated id
 */
export async function queueMutation(
  params: QueueMutationParams
): Promise<MutationQueueEntry> {
  const db = await getDB();

  const entry: Omit<MutationQueueEntry, "id"> = {
    idempotencyKey: uuidv7(),
    operation: params.operation,
    entity: params.entity,
    entityId: params.entityId,
    payload: params.payload,
    timestamp: Date.now(),
    retries: 0,
    status: "pending",
    // Store cached updated_at for conflict detection on updates
    updatedAt: params.cachedUpdatedAt,
  };

  const id = await db.add("mutationQueue", entry as MutationQueueEntry);

  // Notify listeners of queue update
  broadcastQueueUpdate();

  return { ...entry, id } as MutationQueueEntry;
}

/**
 * Get all mutations in the queue.
 *
 * @returns All mutation entries
 */
export async function getMutationQueue(): Promise<MutationQueueEntry[]> {
  const db = await getDB();
  return db.getAll("mutationQueue");
}

/**
 * Get all pending mutations (status = 'pending').
 * Ordered by timestamp (oldest first).
 *
 * @returns Pending mutation entries
 */
export async function getPendingMutations(): Promise<MutationQueueEntry[]> {
  const db = await getDB();
  const mutations = await db.getAllFromIndex(
    "mutationQueue",
    "status",
    "pending"
  );
  // Sort by timestamp (oldest first for FIFO processing)
  return mutations.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get mutations by status.
 *
 * @param status - The status to filter by
 * @returns Mutation entries with the given status
 */
export async function getMutationsByStatus(
  status: MutationStatus
): Promise<MutationQueueEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("mutationQueue", "status", status);
}

/**
 * Get failed mutations for manual retry or review.
 *
 * @returns Failed mutation entries
 */
export async function getFailedMutations(): Promise<MutationQueueEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("mutationQueue", "status", "failed");
}

/**
 * Get count of pending mutations.
 * Useful for UI indicators.
 *
 * @returns Number of pending mutations
 */
export async function getPendingMutationCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex("mutationQueue", "status", "pending");
}

/**
 * Update parameters for a mutation
 */
export interface UpdateMutationParams {
  status: MutationStatus;
  lastError?: string;
  retries?: number;
}

/**
 * Update a mutation's status and optionally error message/retry count.
 *
 * @param id - The mutation ID
 * @param update - The fields to update
 */
export async function updateMutationStatus(
  id: number,
  update: UpdateMutationParams
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("mutationQueue", "readwrite");
  const store = tx.objectStore("mutationQueue");

  const mutation = await store.get(id);
  if (!mutation) {
    await tx.done;
    throw new Error(`Mutation with id ${id} not found`);
  }

  const updated: MutationQueueEntry = {
    ...mutation,
    status: update.status,
    lastError: update.lastError ?? mutation.lastError,
    retries: update.retries ?? mutation.retries,
  };

  await store.put(updated);
  await tx.done;

  // Notify listeners of status change (affects pending count)
  broadcastQueueUpdate();
}

/**
 * Remove a mutation from the queue.
 * Call after successful sync or when user cancels.
 *
 * @param id - The mutation ID to remove
 */
export async function removeMutation(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("mutationQueue", id);

  // Notify listeners of queue update
  broadcastQueueUpdate();
}

/**
 * Remove a mutation by idempotency key.
 * Useful for deduplication when server confirms receipt.
 *
 * @param key - The idempotency key
 */
export async function removeMutationByIdempotencyKey(
  key: string
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("mutationQueue", "readwrite");
  const store = tx.objectStore("mutationQueue");
  const index = store.index("idempotencyKey");

  const mutation = await index.get(key);
  if (mutation) {
    await store.delete(mutation.id);
  }

  await tx.done;

  // Notify listeners of queue update (if mutation was removed)
  if (mutation) {
    broadcastQueueUpdate();
  }
}

/**
 * Clean expired mutations (older than TTL).
 * Returns the number of mutations removed.
 *
 * @returns Number of expired mutations removed
 */
export async function cleanExpiredMutations(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction("mutationQueue", "readwrite");
  const store = tx.objectStore("mutationQueue");
  const index = store.index("timestamp");

  const expirationThreshold = Date.now() - MUTATION_TTL;
  let removedCount = 0;

  // Get all mutations older than threshold
  const range = IDBKeyRange.upperBound(expirationThreshold);
  let cursor = await index.openCursor(range);

  while (cursor) {
    await store.delete(cursor.primaryKey);
    removedCount++;
    cursor = await cursor.continue();
  }

  await tx.done;

  if (removedCount > 0) {
    console.log(`[MutationQueue] Cleaned ${removedCount} expired mutations`);
    // Notify listeners of queue update
    broadcastQueueUpdate();
  }

  return removedCount;
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Calculate delay for next retry using exponential backoff with jitter.
 *
 * Formula: min(maxDelay, initialDelay * factor^retryCount) + jitter
 *
 * @param retryCount - Number of retries so far (0-indexed)
 * @returns Delay in milliseconds before next retry
 */
export function calculateRetryDelay(retryCount: number): number {
  const { initialDelay, maxDelay, factor, jitter } = RETRY_CONFIG;

  // Calculate base delay with exponential backoff
  const baseDelay = Math.min(
    maxDelay,
    initialDelay * Math.pow(factor, retryCount)
  );

  if (!jitter) {
    return baseDelay;
  }

  // Add jitter: random value between 0 and 50% of base delay
  const jitterAmount = Math.random() * 0.5 * baseDelay;
  return Math.floor(baseDelay + jitterAmount);
}

/**
 * Determine if a mutation should be retried based on error/response.
 *
 * Retryable conditions:
 * - Network errors (no response)
 * - Server errors (5xx status codes)
 * - Rate limiting (429)
 * - Request timeout (408)
 *
 * Non-retryable conditions:
 * - Client errors (4xx except 429, 408)
 * - Max retries exceeded (checked separately)
 *
 * @param error - The error that occurred
 * @param response - Optional Response object if available
 * @returns Whether the mutation should be retried
 */
export function shouldRetry(error: Error, response?: Response): boolean {
  // Network error (no response) - always retry
  if (!response) {
    return true;
  }

  const status = response.status;

  // Server errors (5xx) - retry
  if (status >= 500 && status < 600) {
    return true;
  }

  // Rate limiting - retry
  if (status === 429) {
    return true;
  }

  // Request timeout - retry
  if (status === 408) {
    return true;
  }

  // Client errors (4xx) - don't retry (bad request, unauthorized, etc.)
  if (status >= 400 && status < 500) {
    return false;
  }

  // Unexpected status - retry to be safe
  return true;
}

/**
 * Check if a mutation has exceeded max retries.
 *
 * @param mutation - The mutation entry
 * @returns Whether max retries have been exceeded
 */
export function hasExceededMaxRetries(mutation: MutationQueueEntry): boolean {
  return mutation.retries >= RETRY_CONFIG.maxRetries;
}

/**
 * Get a mutation by its idempotency key.
 *
 * @param key - The idempotency key
 * @returns The mutation entry or undefined
 */
export async function getMutationByIdempotencyKey(
  key: string
): Promise<MutationQueueEntry | undefined> {
  const db = await getDB();
  return db.getFromIndex("mutationQueue", "idempotencyKey", key);
}

// ============================================================================
// Sync Payload Helpers
// ============================================================================

/**
 * Prepare a mutation payload for syncing.
 * For update operations with a cached timestamp, includes updated_at
 * for server-side conflict detection.
 *
 * @param mutation - The mutation queue entry
 * @returns Payload with updated_at if applicable
 */
export function prepareSyncPayload(
  mutation: MutationQueueEntry
): Record<string, unknown> {
  // For update operations with cached timestamp, include updated_at
  if (mutation.operation === "update" && mutation.updatedAt) {
    return {
      ...mutation.payload,
      updated_at: mutation.updatedAt,
    };
  }

  return mutation.payload;
}
