// SSE wire types — the verified backend event shape (Phase 6 RESEARCH §"Event
// JSON shape", captured live against the running stack 2026-06-13). The backend
// emits NAMED SSE events (`event: <type>`) whose `data:` payload deserializes to
// this struct. `entity_type` is the invalidation key — note one backend publish
// site emits the uppercase outlier "ITEM", so consumers MUST lowercase before a
// map lookup (RESEARCH §Pitfall 3).

export interface SSEEvent {
  /** "<entity>.<action>", e.g. "category.created" — also the SSE event name. */
  type: string;
  /** Affected entity id; omitempty on the wire. */
  entity_id?: string;
  /** Invalidation key (lowercase EXCEPT the "ITEM" outlier — normalize). */
  entity_type: string;
  /** Workspace the event was scoped to by the backend Broadcaster. */
  workspace_id: string;
  /** Actor who triggered the change. */
  user_id: string;
  /** RFC3339 server timestamp. */
  timestamp: string;
  /** Entity-shaped payload; omitempty on the wire. */
  data?: unknown;
}
