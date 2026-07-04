// Client-only optimistic id for an entity created offline, before the server
// assigns the real id. Prefixed so dependent writes — e.g. a stock entry whose
// item_id points at a not-yet-synced item — can be detected and blocked: the
// backend would 404 on a temp id that never existed server-side.
//
// The prefix is display/gating ONLY. It must NEVER be sent in a request body;
// the create bodies don't carry the id (the server mints it), so tagging the
// cache id is safe. See OFFLINE-PWA-V2-PLAN Phase C, option (a).
const OFFLINE_TEMP_PREFIX = "offline-";

/** Mint a tagged temp id for an optimistic, offline-created row. */
export function newOfflineTempId(): string {
  return `${OFFLINE_TEMP_PREFIX}${crypto.randomUUID()}`;
}

/** True when `id` is an offline temp id (entity not yet synced to the server). */
export function isOfflineTempId(id: string | undefined | null): boolean {
  return typeof id === "string" && id.startsWith(OFFLINE_TEMP_PREFIX);
}
