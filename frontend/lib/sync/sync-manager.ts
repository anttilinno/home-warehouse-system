/**
 * SyncManager Module
 *
 * Orchestrates offline mutation processing with support for Background Sync API
 * (Chrome/Edge) and iOS fallback (online event + visibility change).
 * Communicates with service worker via BroadcastChannel.
 */

import {
  getPendingMutations,
  updateMutationStatus,
  removeMutation,
  calculateRetryDelay,
  shouldRetry,
  getPendingMutationCount,
  RETRY_CONFIG,
  prepareSyncPayload,
  getMutationByIdempotencyKey,
} from "./mutation-queue";
import {
  findConflictFields,
  classifyConflict,
  resolveWithLastWriteWins,
  logConflict,
} from "./conflict-resolver";
import type { MutationQueueEntry, MutationEntityType } from "@/lib/db/types";

// ============================================================================
// Entity Sync Order
// ============================================================================

/**
 * Entity sync order - process entities with no dependencies first.
 * Categories and borrowers have no FK dependencies.
 * Locations have self-referential hierarchy (handled by topological sort in Phase 7+).
 * Containers depend on locations.
 * Items depend on categories (optional).
 * Inventory depends on items, locations, containers.
 * Loans depend on inventory, borrowers.
 */
export const ENTITY_SYNC_ORDER: MutationEntityType[] = [
  "categories",
  "locations",
  "borrowers",
  "containers",
  "items",
  "inventory",
  "loans",
];

// ============================================================================
// Types
// ============================================================================

/**
 * Sync event types for communication between SyncManager and listeners
 */
export type SyncEventType =
  | "SYNC_STARTED"
  | "SYNC_COMPLETE"
  | "SYNC_ERROR"
  | "SYNC_REQUESTED"
  | "MUTATION_SYNCED"
  | "MUTATION_FAILED"
  | "MUTATION_CASCADE_FAILED"
  | "MUTATION_SKIPPED_DEPENDENCY"
  | "QUEUE_UPDATED"
  | "CONFLICT_DETECTED"
  | "CONFLICT_AUTO_RESOLVED"
  | "CONFLICT_NEEDS_REVIEW";

/**
 * Conflict data included in conflict events
 */
export interface ConflictEventPayload {
  entityType: string;
  entityId: string;
  entityName?: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  conflictFields: string[];
  isCritical: boolean;
}

/**
 * Sync event payload structure
 */
export interface SyncEvent {
  type: SyncEventType;
  payload?: {
    queueLength?: number;
    mutation?: MutationQueueEntry;
    error?: string;
    source?: string;
    conflict?: ConflictEventPayload;
  };
}

/**
 * Callback type for sync event listeners
 */
export type SyncEventListener = (event: SyncEvent) => void;

// ============================================================================
// Topological Sort for Hierarchical Entities
// ============================================================================

/**
 * Sort category mutations topologically by parent-child dependency.
 * Uses Kahn's algorithm to ensure parents are created before children.
 *
 * @param mutations - Array of category mutation entries
 * @returns Sorted array with creates ordered by dependency, followed by updates
 */
export function topologicalSortCategories(mutations: MutationQueueEntry[]): MutationQueueEntry[] {
  // Only sort create operations (updates don't create new IDs)
  const creates = mutations.filter(m => m.operation === 'create');
  const updates = mutations.filter(m => m.operation === 'update');

  if (creates.length <= 1) return [...creates, ...updates];

  // Build dependency graph from parent_category_id references
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  // Initialize
  for (const m of creates) {
    indegree.set(m.idempotencyKey, 0);
    children.set(m.idempotencyKey, []);
  }

  // Build edges from parent references where parent is also a pending create
  const keySet = new Set(creates.map(m => m.idempotencyKey));
  for (const m of creates) {
    const parentId = m.payload.parent_category_id as string | null;
    if (parentId && keySet.has(parentId)) {
      // parentId is another pending create's temp ID
      indegree.set(m.idempotencyKey, (indegree.get(m.idempotencyKey) || 0) + 1);
      children.get(parentId)!.push(m.idempotencyKey);
    }
  }

  // Kahn's algorithm: start with nodes with indegree 0
  const queue = creates.filter(m => indegree.get(m.idempotencyKey) === 0);
  const sorted: MutationQueueEntry[] = [];

  while (queue.length > 0) {
    const m = queue.shift()!;
    sorted.push(m);
    for (const childKey of children.get(m.idempotencyKey) || []) {
      const newDegree = (indegree.get(childKey) || 1) - 1;
      indegree.set(childKey, newDegree);
      if (newDegree === 0) {
        const child = creates.find(c => c.idempotencyKey === childKey);
        if (child) queue.push(child);
      }
    }
  }

  // Combine sorted creates with updates
  return [...sorted, ...updates];
}

/**
 * Sort location mutations topologically by parent-child dependency.
 * Uses Kahn's algorithm to ensure parents are created before children.
 *
 * @param mutations - Array of location mutation entries
 * @returns Sorted array with creates ordered by dependency, followed by updates
 */
export function topologicalSortLocations(mutations: MutationQueueEntry[]): MutationQueueEntry[] {
  // Only sort create operations (updates don't create new IDs)
  const creates = mutations.filter(m => m.operation === 'create');
  const updates = mutations.filter(m => m.operation === 'update');

  if (creates.length <= 1) return [...creates, ...updates];

  // Build dependency graph from parent_location references
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  // Initialize
  for (const m of creates) {
    indegree.set(m.idempotencyKey, 0);
    children.set(m.idempotencyKey, []);
  }

  // Build edges from parent references where parent is also a pending create
  const keySet = new Set(creates.map(m => m.idempotencyKey));
  for (const m of creates) {
    const parentId = m.payload.parent_location as string | null;
    if (parentId && keySet.has(parentId)) {
      // parentId is another pending create's temp ID
      indegree.set(m.idempotencyKey, (indegree.get(m.idempotencyKey) || 0) + 1);
      children.get(parentId)!.push(m.idempotencyKey);
    }
  }

  // Kahn's algorithm: start with nodes with indegree 0
  const queue = creates.filter(m => indegree.get(m.idempotencyKey) === 0);
  const sorted: MutationQueueEntry[] = [];

  while (queue.length > 0) {
    const m = queue.shift()!;
    sorted.push(m);
    for (const childKey of children.get(m.idempotencyKey) || []) {
      const newDegree = (indegree.get(childKey) || 1) - 1;
      indegree.set(childKey, newDegree);
      if (newDegree === 0) {
        const child = creates.find(c => c.idempotencyKey === childKey);
        if (child) queue.push(child);
      }
    }
  }

  // Combine sorted creates with updates
  return [...sorted, ...updates];
}

// ============================================================================
// SyncManager Class
// ============================================================================

/**
 * SyncManager handles offline mutation queue processing.
 *
 * Features:
 * - Queue processing with locking to prevent concurrent runs
 * - BroadcastChannel for SW-to-main-thread communication
 * - iOS fallback with online event + visibilitychange handlers
 * - Retry logic with exponential backoff
 * - Event subscription for UI updates
 */
export class SyncManager {
  /** Flag to prevent concurrent queue processing */
  private isProcessing = false;

  /** BroadcastChannel for SW communication */
  private channel: BroadcastChannel | null = null;

  /** Set of event listeners */
  private listeners: Set<SyncEventListener> = new Set();

  /** Cleanup function for fallback listeners */
  private fallbackCleanup: (() => void) | null = null;

  constructor() {
    // Initialize BroadcastChannel if available
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("sync-status");
      this.channel.onmessage = (event: MessageEvent<SyncEvent>) => {
        this.handleChannelMessage(event.data);
      };
    }
  }

  // ==========================================================================
  // Event Subscription
  // ==========================================================================

  /**
   * Subscribe to sync events.
   *
   * @param callback - Function to call when sync events occur
   * @returns Unsubscribe function
   */
  subscribe(callback: SyncEventListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Broadcast event to all listeners and the BroadcastChannel.
   *
   * @param event - The sync event to broadcast
   */
  private broadcast(event: SyncEvent): void {
    // Notify local listeners
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("[SyncManager] Listener error:", error);
      }
    });

    // Broadcast to service worker via channel
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (error) {
        console.error("[SyncManager] BroadcastChannel error:", error);
      }
    }
  }

  /**
   * Handle messages received from service worker via BroadcastChannel.
   *
   * @param data - The sync event data
   */
  private handleChannelMessage(data: SyncEvent): void {
    console.log("[SyncManager] Received from SW:", data.type);

    // If SW requests sync, process the queue
    if (data.type === "SYNC_REQUESTED") {
      this.processQueue();
      return;
    }

    // Forward other events to listeners
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[SyncManager] Listener error:", error);
      }
    });
  }

  // ==========================================================================
  // Queue Processing
  // ==========================================================================

  /**
   * Process the mutation queue.
   * Implements locking to prevent concurrent processing.
   * Processes mutations in entity-type order to respect dependencies.
   */
  async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log("[SyncManager] Already processing, skipping");
      return;
    }

    // Skip if offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.log("[SyncManager] Offline, skipping queue processing");
      return;
    }

    this.isProcessing = true;
    this.broadcast({ type: "SYNC_STARTED" });

    // Track synced idempotency keys for dependency checking
    const syncedKeys = new Set<string>();
    // Track failed idempotency keys for cascade failure
    const failedKeys = new Set<string>();

    try {
      const pending = await getPendingMutations();
      console.log(`[SyncManager] Processing ${pending.length} pending mutations`);

      // Group mutations by entity type
      const byEntity = new Map<MutationEntityType, MutationQueueEntry[]>();
      for (const mutation of pending) {
        const existing = byEntity.get(mutation.entity) || [];
        existing.push(mutation);
        byEntity.set(mutation.entity, existing);
      }

      // Process in entity order
      for (const entityType of ENTITY_SYNC_ORDER) {
        const mutations = byEntity.get(entityType) || [];
        if (mutations.length === 0) continue;

        // Apply topological sort for hierarchical entities
        let sortedMutations: MutationQueueEntry[];
        if (entityType === 'categories') {
          sortedMutations = topologicalSortCategories(mutations);
        } else if (entityType === 'locations') {
          sortedMutations = topologicalSortLocations(mutations);
        } else {
          sortedMutations = mutations;
        }

        console.log(`[SyncManager] Processing ${sortedMutations.length} ${entityType} mutations`);

        for (const mutation of sortedMutations) {
          // Check if dependencies have failed - cascade failure
          const cascadeFailed = await this.hasCascadeFailure(mutation, failedKeys);
          if (cascadeFailed) {
            console.log(`[SyncManager] Cascade failure for mutation ${mutation.id}`);
            await updateMutationStatus(mutation.id, {
              status: "failed",
              lastError: "Parent mutation failed",
            });
            failedKeys.add(mutation.idempotencyKey);
            this.broadcast({
              type: "MUTATION_CASCADE_FAILED",
              payload: { mutation },
            });
            continue;
          }

          // Check if dependencies have synced
          const depsReady = await this.areDependenciesSynced(mutation, syncedKeys);
          if (!depsReady) {
            console.log(`[SyncManager] Skipping mutation ${mutation.id} - dependencies not synced`);
            this.broadcast({
              type: "MUTATION_SKIPPED_DEPENDENCY",
              payload: { mutation },
            });
            continue;
          }

          const success = await this.processMutation(mutation);

          if (success) {
            syncedKeys.add(mutation.idempotencyKey);
          } else if (mutation.retries >= RETRY_CONFIG.maxRetries) {
            // Max retries reached, mark as failed
            await updateMutationStatus(mutation.id, { status: "failed" });
            failedKeys.add(mutation.idempotencyKey);
            this.broadcast({ type: "MUTATION_FAILED", payload: { mutation } });
          }
        }
      }

      const queueLength = await this.getPendingCount();
      this.broadcast({ type: "SYNC_COMPLETE", payload: { queueLength } });
    } catch (error) {
      console.error("[SyncManager] Queue processing error:", error);
      this.broadcast({
        type: "SYNC_ERROR",
        payload: { error: String(error) },
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single mutation.
   *
   * @param mutation - The mutation to process
   * @returns True if successful, false if needs retry
   */
  private async processMutation(mutation: MutationQueueEntry): Promise<boolean> {
    // Mark as syncing
    await updateMutationStatus(mutation.id, { status: "syncing" });

    try {
      const url = this.buildApiUrl(mutation);
      const method = mutation.operation === "create" ? "POST" : "PATCH";

      console.log(`[SyncManager] Sending ${method} to ${url}`);

      // Use prepareSyncPayload to include updated_at for conflict detection
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": mutation.idempotencyKey,
        },
        body: JSON.stringify(prepareSyncPayload(mutation)),
        credentials: "include",
      });

      if (response.ok || response.status === 202) {
        // Success or accepted (approval pipeline)
        console.log(`[SyncManager] Mutation ${mutation.id} synced successfully`);
        await removeMutation(mutation.id);
        this.broadcast({ type: "MUTATION_SYNCED", payload: { mutation } });
        return true;
      }

      // Handle conflict response (409)
      if (response.status === 409) {
        console.log(`[SyncManager] Conflict detected for mutation ${mutation.id}`);
        try {
          const conflictData = await response.json();
          return this.handleConflict(mutation, conflictData);
        } catch {
          // If we can't parse conflict data, treat as regular error
          console.warn("[SyncManager] Failed to parse conflict response");
        }
      }

      // Check if we should retry
      if (!shouldRetry(new Error(`HTTP ${response.status}`), response)) {
        // Client error (4xx except 429, 408, 409), don't retry
        const errorText = await response.text();
        console.log(`[SyncManager] Mutation ${mutation.id} failed permanently: ${response.status}`);
        await updateMutationStatus(mutation.id, {
          status: "failed",
          lastError: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        });
        return false;
      }

      // Retry later
      const delay = calculateRetryDelay(mutation.retries);
      console.log(`[SyncManager] Will retry mutation ${mutation.id} in ${delay}ms`);
      await updateMutationStatus(mutation.id, {
        status: "pending",
        retries: mutation.retries + 1,
      });
      return false;
    } catch (error) {
      // Network error - retry later
      console.log(`[SyncManager] Network error for mutation ${mutation.id}:`, error);
      await updateMutationStatus(mutation.id, {
        status: "pending",
        retries: mutation.retries + 1,
        lastError: String(error),
      });
      return false;
    }
  }

  /**
   * Handle a 409 Conflict response from the server.
   *
   * Classifies the conflict as critical or non-critical:
   * - Non-critical: Auto-resolve with LWW (server wins), show toast
   * - Critical: Queue for user review, show dialog
   *
   * @param mutation - The mutation that caused the conflict
   * @param serverResponse - The server's conflict response data
   * @returns True if handled (removed from queue), false if needs user review
   */
  private async handleConflict(
    mutation: MutationQueueEntry,
    serverResponse: { server_data: Record<string, unknown>; updated_at?: string }
  ): Promise<boolean> {
    const localData = mutation.payload;
    const serverData = serverResponse.server_data;

    // Find which fields differ
    const conflictFields = findConflictFields(localData, serverData);

    // Classify as critical or non-critical
    const isCritical = classifyConflict(mutation.entity, conflictFields);

    // Broadcast that a conflict was detected
    this.broadcast({
      type: "CONFLICT_DETECTED",
      payload: {
        mutation,
        conflict: {
          entityType: mutation.entity,
          entityId: mutation.entityId!,
          localData,
          serverData,
          conflictFields,
          isCritical,
        },
      },
    });

    if (!isCritical) {
      // Auto-resolve with LWW (server version wins)
      const resolved = resolveWithLastWriteWins(serverData);

      // Log the conflict to IndexedDB
      await logConflict({
        entityType: mutation.entity,
        entityId: mutation.entityId!,
        localData,
        serverData,
        conflictFields,
        resolution: "server",
        resolvedData: resolved,
        timestamp: Date.now(),
        resolvedAt: Date.now(),
      });

      // Remove mutation from queue (server version wins)
      await removeMutation(mutation.id);

      // Notify listeners of auto-resolution
      this.broadcast({
        type: "CONFLICT_AUTO_RESOLVED",
        payload: {
          mutation,
          conflict: {
            entityType: mutation.entity,
            entityId: mutation.entityId!,
            localData,
            serverData,
            conflictFields,
            isCritical: false,
          },
        },
      });

      console.log(`[SyncManager] Conflict auto-resolved for ${mutation.entity}/${mutation.entityId}`);
      return true;
    }

    // Critical conflict - needs user review
    // Reset to pending (not failed) so it can be retried after resolution
    await updateMutationStatus(mutation.id, { status: "pending" });

    // Log the conflict to IndexedDB (without resolution yet)
    await logConflict({
      entityType: mutation.entity,
      entityId: mutation.entityId!,
      localData,
      serverData,
      conflictFields,
      resolution: "server", // Will be updated when user resolves
      timestamp: Date.now(),
    });

    // Notify listeners that user review is needed
    this.broadcast({
      type: "CONFLICT_NEEDS_REVIEW",
      payload: {
        mutation,
        conflict: {
          entityType: mutation.entity,
          entityId: mutation.entityId!,
          localData,
          serverData,
          conflictFields,
          isCritical: true,
        },
      },
    });

    console.log(`[SyncManager] Critical conflict needs review for ${mutation.entity}/${mutation.entityId}`);
    return false;
  }

  /**
   * Check if all dependencies for a mutation have been synced.
   * A mutation depends on other mutations via the dependsOn array of idempotency keys.
   *
   * @param mutation - The mutation to check
   * @param syncedKeys - Set of idempotency keys that have been successfully synced in this run
   * @returns True if all dependencies are synced or mutation has no dependencies
   */
  private async areDependenciesSynced(
    mutation: MutationQueueEntry,
    syncedKeys: Set<string>
  ): Promise<boolean> {
    // No dependencies - can proceed
    if (!mutation.dependsOn || mutation.dependsOn.length === 0) {
      return true;
    }

    // Check each dependency
    for (const depKey of mutation.dependsOn) {
      // Already synced in this run - OK
      if (syncedKeys.has(depKey)) {
        continue;
      }

      // Check if dependency still exists in queue (not synced yet)
      const depMutation = await getMutationByIdempotencyKey(depKey);
      if (depMutation) {
        // Dependency still pending - cannot proceed
        console.log(
          `[SyncManager] Mutation ${mutation.id} waiting for dependency ${depKey}`
        );
        return false;
      }
      // Dependency not in queue - either already synced in previous run or removed
      // Assume it's OK to proceed
    }

    return true;
  }

  /**
   * Check if any dependency has failed, triggering cascade failure.
   *
   * @param mutation - The mutation to check
   * @param failedKeys - Set of idempotency keys that have failed in this run
   * @returns True if any dependency has failed
   */
  private async hasCascadeFailure(
    mutation: MutationQueueEntry,
    failedKeys: Set<string>
  ): Promise<boolean> {
    // No dependencies - no cascade failure possible
    if (!mutation.dependsOn || mutation.dependsOn.length === 0) {
      return false;
    }

    // Check each dependency
    for (const depKey of mutation.dependsOn) {
      // Failed in this run - cascade failure
      if (failedKeys.has(depKey)) {
        return true;
      }

      // Check if dependency exists and is in failed status
      const depMutation = await getMutationByIdempotencyKey(depKey);
      if (depMutation && depMutation.status === "failed") {
        return true;
      }
    }

    return false;
  }

  /**
   * Build the API URL for a mutation based on entity type.
   *
   * @param mutation - The mutation entry
   * @returns The full API URL
   */
  private buildApiUrl(mutation: MutationQueueEntry): string {
    const workspaceId =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("workspace_id")
        : null;

    if (!workspaceId) {
      throw new Error("No workspace ID available");
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const entityPath = `${baseUrl}/api/workspaces/${workspaceId}/${mutation.entity}`;

    if (mutation.operation === "update" && mutation.entityId) {
      return `${entityPath}/${mutation.entityId}`;
    }

    return entityPath;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get the current count of pending mutations.
   *
   * @returns Number of pending mutations
   */
  async getPendingCount(): Promise<number> {
    return getPendingMutationCount();
  }

  /**
   * Retry a specific failed mutation.
   * Resets status to pending and triggers queue processing.
   *
   * @param id - The mutation ID to retry
   */
  async retryMutation(id: number): Promise<void> {
    await updateMutationStatus(id, { status: "pending", retries: 0 });
    this.broadcast({ type: "QUEUE_UPDATED" });
    await this.processQueue();
  }

  /**
   * Cancel a pending mutation by removing it from the queue.
   *
   * @param id - The mutation ID to cancel
   */
  async cancelMutation(id: number): Promise<void> {
    await removeMutation(id);
    this.broadcast({ type: "QUEUE_UPDATED" });
  }

  /**
   * Check if Background Sync API is supported.
   *
   * @returns True if Background Sync is available
   */
  supportsBackgroundSync(): boolean {
    return (
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      "SyncManager" in window
    );
  }

  /**
   * Register for Background Sync.
   * Sends message to service worker to register sync.
   */
  async registerBackgroundSync(): Promise<void> {
    if (!this.supportsBackgroundSync()) {
      console.log("[SyncManager] Background Sync not supported");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // TypeScript doesn't have full types for Background Sync API
      const sync = (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;

      if (sync) {
        await sync.register("mutation-queue-sync");
        console.log("[SyncManager] Background Sync registered");
      }
    } catch (error) {
      console.warn("[SyncManager] Background Sync registration failed:", error);
      // Fallback handled by online event
    }
  }

  /**
   * Setup iOS fallback event listeners.
   * Uses online event and visibilitychange for browsers without Background Sync.
   *
   * @returns Cleanup function to remove listeners
   */
  setupFallbackListeners(): () => void {
    // Clean up any existing listeners
    if (this.fallbackCleanup) {
      this.fallbackCleanup();
    }

    const handleOnline = () => {
      console.log("[SyncManager] Online event - processing queue");
      this.processQueue();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        console.log("[SyncManager] Visibility change - processing queue");
        this.processQueue();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    this.fallbackCleanup = () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };

    return this.fallbackCleanup;
  }

  /**
   * Clean up resources when SyncManager is no longer needed.
   */
  destroy(): void {
    if (this.fallbackCleanup) {
      this.fallbackCleanup();
      this.fallbackCleanup = null;
    }

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    this.listeners.clear();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton SyncManager instance.
 * Only created in browser environment.
 */
export const syncManager: SyncManager | null =
  typeof window !== "undefined" ? new SyncManager() : null;
