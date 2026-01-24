/**
 * Conflict Resolution Module
 *
 * Handles detection, classification, and resolution of sync conflicts.
 * Critical fields require user review; non-critical fields are auto-resolved
 * with last-write-wins (server version).
 */

import { getDB, getById } from "@/lib/db/offline-db";
import type {
  MutationEntityType,
  MutationQueueEntry,
  ConflictLogEntry,
  ConflictResolution,
} from "@/lib/db/types";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Critical fields that require manual review when in conflict.
 * These fields have business-critical implications that shouldn't
 * be auto-resolved with last-write-wins.
 */
export const CRITICAL_FIELDS: Record<string, string[]> = {
  inventory: ["quantity", "status"],
  loans: ["quantity", "returned_at"],
};

// ============================================================================
// Types
// ============================================================================

/**
 * Data needed to analyze a conflict
 */
export interface ConflictData {
  /** Type of entity in conflict */
  entityType: MutationEntityType;
  /** ID of the entity */
  entityId: string;
  /** Local (client) version of the data */
  localData: Record<string, unknown>;
  /** Server version of the data */
  serverData: Record<string, unknown>;
  /** Local updated_at timestamp (ISO string) */
  localUpdatedAt: string;
  /** Server updated_at timestamp (ISO string) */
  serverUpdatedAt: string;
}

/**
 * Result of conflict analysis
 */
export interface ConflictResult {
  /** Whether a conflict exists */
  hasConflict: boolean;
  /** Whether the conflict involves critical fields */
  isCritical: boolean;
  /** List of fields that differ between local and server */
  conflictFields: string[];
  /** Resolution strategy (only set for non-critical auto-resolved conflicts) */
  resolution?: ConflictResolution;
  /** Resolved data (only set for non-critical auto-resolved conflicts) */
  resolvedData?: Record<string, unknown>;
}

/**
 * Backend batch operation result format
 */
export interface BatchResult {
  /** Index of the operation in the batch */
  index: number;
  /** Operation status */
  status: "success" | "error" | "conflict";
  /** Entity ID (for successful creates) */
  entity_id?: string;
  /** Whether a conflict was detected */
  has_conflict?: boolean;
  /** Server version of the data (on conflict) */
  server_data?: Record<string, unknown>;
  /** Error message (on error) */
  error?: string;
  /** Error code (on error) */
  error_code?: string;
}

// ============================================================================
// Fields to Exclude from Comparison
// ============================================================================

/**
 * Fields to exclude when comparing local vs server data.
 * These are metadata fields that are expected to differ.
 */
const EXCLUDED_FIELDS = new Set([
  "updated_at",
  "created_at",
  "workspace_id",
  "id",
]);

// ============================================================================
// Conflict Detection Functions
// ============================================================================

/**
 * Detect if there's a conflict based on timestamps.
 * A conflict exists when the server version is newer than the local version.
 *
 * @param localUpdatedAt - Local updated_at timestamp (ISO string)
 * @param serverUpdatedAt - Server updated_at timestamp (ISO string)
 * @returns true if server is newer (conflict exists)
 */
export function detectConflict(
  localUpdatedAt: string,
  serverUpdatedAt: string
): boolean {
  const localTime = new Date(localUpdatedAt).getTime();
  const serverTime = new Date(serverUpdatedAt).getTime();

  // Conflict exists if server version is newer
  return serverTime > localTime;
}

/**
 * Find fields that differ between local and server data.
 * Excludes metadata fields (updated_at, created_at, etc.)
 *
 * @param localData - Local version of the data
 * @param serverData - Server version of the data
 * @returns Array of field names that have different values
 */
export function findConflictFields(
  localData: Record<string, unknown>,
  serverData: Record<string, unknown>
): string[] {
  const conflictFields: string[] = [];

  // Check all keys in local data
  for (const key of Object.keys(localData)) {
    if (EXCLUDED_FIELDS.has(key)) continue;

    const localValue = localData[key];
    const serverValue = serverData[key];

    // Compare values (handles null, undefined, and nested objects)
    if (!valuesEqual(localValue, serverValue)) {
      conflictFields.push(key);
    }
  }

  // Check for keys only in server data
  for (const key of Object.keys(serverData)) {
    if (EXCLUDED_FIELDS.has(key)) continue;
    if (!(key in localData)) {
      // Server has a field that local doesn't - could be a conflict
      if (serverData[key] !== null && serverData[key] !== undefined) {
        conflictFields.push(key);
      }
    }
  }

  return conflictFields;
}

/**
 * Compare two values for equality.
 * Handles primitives, null/undefined, and nested objects.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  // Handle null/undefined
  if (a === null || a === undefined) {
    return b === null || b === undefined;
  }
  if (b === null || b === undefined) {
    return false;
  }

  // Handle primitives
  if (typeof a !== "object" || typeof b !== "object") {
    return a === b;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => valuesEqual(val, b[idx]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  // Handle objects (shallow comparison for now)
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => valuesEqual(aObj[key], bObj[key]));
}

// ============================================================================
// Conflict Classification
// ============================================================================

/**
 * Classify whether a conflict involves critical fields.
 * Critical fields require user review rather than auto-resolution.
 *
 * @param entityType - Type of entity
 * @param conflictFields - List of fields in conflict
 * @returns true if any conflicting field is critical
 */
export function classifyConflict(
  entityType: string,
  conflictFields: string[]
): boolean {
  const criticalFieldsForEntity = CRITICAL_FIELDS[entityType] || [];

  return conflictFields.some((field) => criticalFieldsForEntity.includes(field));
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Resolve a conflict using last-write-wins strategy.
 * Simply returns the server data as the winner.
 *
 * @param serverData - Server version of the data
 * @returns Server data as the resolved version
 */
export function resolveWithLastWriteWins(
  serverData: Record<string, unknown>
): Record<string, unknown> {
  return { ...serverData };
}

/**
 * Analyze and potentially resolve a conflict.
 *
 * - If no conflict: returns { hasConflict: false }
 * - If non-critical conflict: auto-resolves with LWW and returns resolved data
 * - If critical conflict: returns conflict info without resolution
 *
 * @param conflict - Conflict data to analyze
 * @returns Conflict analysis result
 */
export function resolveConflict(conflict: ConflictData): ConflictResult {
  // Check if there's actually a conflict based on timestamps
  const hasConflict = detectConflict(
    conflict.localUpdatedAt,
    conflict.serverUpdatedAt
  );

  if (!hasConflict) {
    return {
      hasConflict: false,
      isCritical: false,
      conflictFields: [],
    };
  }

  // Find which fields differ
  const conflictFields = findConflictFields(
    conflict.localData,
    conflict.serverData
  );

  // If no fields differ despite timestamp change, no real conflict
  if (conflictFields.length === 0) {
    return {
      hasConflict: false,
      isCritical: false,
      conflictFields: [],
    };
  }

  // Classify the conflict
  const isCritical = classifyConflict(conflict.entityType, conflictFields);

  // If critical, return without auto-resolution (requires UI)
  if (isCritical) {
    return {
      hasConflict: true,
      isCritical: true,
      conflictFields,
    };
  }

  // Non-critical: auto-resolve with last-write-wins
  const resolvedData = resolveWithLastWriteWins(conflict.serverData);

  return {
    hasConflict: true,
    isCritical: false,
    conflictFields,
    resolution: "server",
    resolvedData,
  };
}

// ============================================================================
// Conflict Logging
// ============================================================================

/**
 * Log a conflict to IndexedDB for user review and debugging.
 *
 * @param entry - Conflict log entry (without auto-generated id)
 * @returns The auto-generated id of the logged entry
 */
export async function logConflict(
  entry: Omit<ConflictLogEntry, "id">
): Promise<number> {
  const db = await getDB();
  const id = await db.add("conflictLog", entry as ConflictLogEntry);
  return id;
}

/**
 * Get recent conflicts from the log, ordered by timestamp (newest first).
 *
 * @param limit - Maximum number of entries to return (default: 50)
 * @returns Array of conflict log entries
 */
export async function getConflictLog(
  limit: number = 50
): Promise<ConflictLogEntry[]> {
  const db = await getDB();
  const tx = db.transaction("conflictLog", "readonly");
  const store = tx.objectStore("conflictLog");
  const index = store.index("timestamp");

  const conflicts: ConflictLogEntry[] = [];
  let cursor = await index.openCursor(null, "prev"); // newest first

  while (cursor && conflicts.length < limit) {
    conflicts.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return conflicts;
}

// ============================================================================
// Mutation Payload Enhancement Helpers
// ============================================================================

/**
 * Get the updated_at timestamp for an entity from IndexedDB cache.
 *
 * @param entityType - Type of entity to look up
 * @param entityId - ID of the entity
 * @returns ISO timestamp string or null if not found
 */
export async function getEntityUpdatedAt(
  entityType: MutationEntityType,
  entityId: string
): Promise<string | null> {
  const entity = await getById<{ updated_at?: string }>(entityType, entityId);

  if (!entity || !entity.updated_at) {
    return null;
  }

  return entity.updated_at;
}

/**
 * Enhance a mutation payload with the current cached timestamp.
 * For update operations, includes updated_at for conflict detection.
 * For create operations, returns payload unchanged.
 *
 * @param mutation - The mutation queue entry
 * @returns Enhanced payload with updated_at if applicable
 */
export async function enhanceMutationWithTimestamp(
  mutation: MutationQueueEntry
): Promise<Record<string, unknown>> {
  // Create operations don't need timestamp enhancement
  if (mutation.operation === "create") {
    return { ...mutation.payload };
  }

  // Update operations: include the cached updated_at
  if (!mutation.entityId) {
    console.warn(
      "[ConflictResolver] Update operation missing entityId:",
      mutation
    );
    return { ...mutation.payload };
  }

  const updatedAt = await getEntityUpdatedAt(mutation.entity, mutation.entityId);

  if (!updatedAt) {
    // Entity not in cache - proceed without timestamp
    console.warn(
      `[ConflictResolver] Entity ${mutation.entity}/${mutation.entityId} not in cache`
    );
    return { ...mutation.payload };
  }

  return {
    ...mutation.payload,
    updated_at: updatedAt,
  };
}

/**
 * Parse a batch result to extract conflict data if present.
 *
 * @param result - Batch operation result from server
 * @param mutation - The original mutation that was sent
 * @returns ConflictData if a conflict was detected, null otherwise
 */
export function parseBatchConflictResponse(
  result: BatchResult,
  mutation: MutationQueueEntry
): ConflictData | null {
  // No conflict if status isn't 'conflict'
  if (result.status !== "conflict") {
    return null;
  }

  // Must have server data to analyze conflict
  if (!result.server_data) {
    console.warn(
      "[ConflictResolver] Conflict response missing server_data:",
      result
    );
    return null;
  }

  // Get entity ID from mutation or result
  const entityId = mutation.entityId || result.entity_id;
  if (!entityId) {
    console.warn(
      "[ConflictResolver] Cannot determine entity ID for conflict:",
      result
    );
    return null;
  }

  // Extract timestamps
  const localUpdatedAt =
    (mutation.payload.updated_at as string) ||
    new Date(mutation.timestamp).toISOString();
  const serverUpdatedAt =
    (result.server_data.updated_at as string) || new Date().toISOString();

  return {
    entityType: mutation.entity,
    entityId,
    localData: mutation.payload,
    serverData: result.server_data,
    localUpdatedAt,
    serverUpdatedAt,
  };
}
