// Idempotency-Key minting for offline-queued writes (Phase 3). One key per
// mutation, minted once at enqueue and carried in the persisted variables so a
// replay after reconnect reuses the SAME key — the backend dedupes on it and
// returns the original response instead of creating a duplicate.
export function newIdemKey(): string {
  return crypto.randomUUID();
}
