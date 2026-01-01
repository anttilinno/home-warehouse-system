import { db, type PendingMutation, type MutationType, type EntityType } from './db';

const MAX_RETRIES = 3;

/**
 * Add a mutation to the offline queue
 */
export async function queueMutation(
  type: MutationType,
  entity: EntityType,
  payload: unknown,
  workspaceId: string,
  entityId?: string
): Promise<number> {
  const mutation: Omit<PendingMutation, 'id'> = {
    type,
    entity,
    entityId,
    payload,
    workspaceId,
    createdAt: Date.now(),
    retryCount: 0,
  };

  const id = await db.pendingMutations.add(mutation as PendingMutation);
  return id as number;
}

/**
 * Get all pending mutations for a workspace, ordered by creation time
 */
export async function getPendingMutations(workspaceId: string): Promise<PendingMutation[]> {
  return db.pendingMutations
    .where('workspaceId')
    .equals(workspaceId)
    .sortBy('createdAt');
}

/**
 * Get the next mutation to process (oldest first)
 */
export async function getNextMutation(workspaceId: string): Promise<PendingMutation | undefined> {
  const mutations = await db.pendingMutations
    .where('workspaceId')
    .equals(workspaceId)
    .sortBy('createdAt');

  return mutations[0];
}

/**
 * Mark a mutation as completed (remove it)
 */
export async function completeMutation(id: number): Promise<void> {
  await db.pendingMutations.delete(id);
}

/**
 * Mark multiple mutations as completed (remove them)
 */
export async function completeAllMutations(ids: number[]): Promise<void> {
  await db.pendingMutations.bulkDelete(ids);
}

/**
 * Mark a mutation as failed, increment retry count
 */
export async function failMutation(id: number, error: string): Promise<boolean> {
  const mutation = await db.pendingMutations.get(id);
  if (!mutation) return false;

  const newRetryCount = mutation.retryCount + 1;

  if (newRetryCount >= MAX_RETRIES) {
    // Mark as permanently failed by setting a very high retry count
    await db.pendingMutations.update(id, {
      retryCount: newRetryCount,
      lastError: `[FAILED] ${error}`,
    });
    return false; // Indicates mutation is permanently failed
  }

  await db.pendingMutations.update(id, {
    retryCount: newRetryCount,
    lastError: error,
  });

  return true; // Indicates mutation can be retried
}

/**
 * Remove a specific mutation
 */
export async function removeMutation(id: number): Promise<void> {
  await db.pendingMutations.delete(id);
}

/**
 * Get count of pending mutations
 */
export async function getMutationCount(workspaceId: string): Promise<number> {
  return db.pendingMutations
    .where('workspaceId')
    .equals(workspaceId)
    .count();
}

/**
 * Get count of failed mutations (exceeded retry limit)
 */
export async function getFailedMutationCount(workspaceId: string): Promise<number> {
  const mutations = await db.pendingMutations
    .where('workspaceId')
    .equals(workspaceId)
    .toArray();

  return mutations.filter(m => m.retryCount >= MAX_RETRIES).length;
}

/**
 * Clear all mutations for a workspace
 */
export async function clearMutations(workspaceId: string): Promise<void> {
  await db.pendingMutations
    .where('workspaceId')
    .equals(workspaceId)
    .delete();
}

/**
 * Clear failed mutations only
 */
export async function clearFailedMutations(workspaceId: string): Promise<void> {
  const mutations = await db.pendingMutations
    .where('workspaceId')
    .equals(workspaceId)
    .toArray();

  const failedIds = mutations
    .filter(m => m.retryCount >= MAX_RETRIES)
    .map(m => m.id!)
    .filter(id => id !== undefined);

  await db.pendingMutations.bulkDelete(failedIds);
}
