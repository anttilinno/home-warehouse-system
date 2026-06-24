// SSE invalidation map — the EXECUTABLE mirror of the human-readable SSOT at
// `frontend/docs/sse-invalidation-contract.md`. Phases 7-10 APPEND a row here
// AND a row in that doc when they wire a new entity's queries.
//
// Convention (locked, RESEARCH §Pattern 3 + Open-Questions resolution): every
// workspace-scoped query keys as `[entityPlural, wsId, ...rest]`; the dispatcher
// fires `invalidateQueries({ queryKey: [entityPlural, wsId] })`, which TanStack
// v5 prefix-matches (exact:false), so trailing filter segments are covered too.
//
// Keys are LOWERCASE entity_type. The backend emits one uppercase "ITEM" outlier
// (RESEARCH §Pitfall 3), so `prefixesFor` lowercases before the lookup — never
// add an uppercase key here.

export const INVALIDATION_MAP: Record<string, readonly (readonly unknown[])[]> =
  {
    category: [["categories"]],
    location: [["locations"]],
    container: [["containers"]],
    item: [["items"]],
    inventory: [["inventory"]],
    loan: [["loans"]],
    borrower: [["borrowers"]],
    // Phases 7-10 APPEND rows here (and document in sse-invalidation-contract.md).
  };

// Full enumerated backend `type` strings (the SSE `event:` line names) from
// RESEARCH §"Full enumerated type values", plus the open-frame "connected".
// SSEProvider registers exactly one addEventListener per name — EventSource
// matches event names EXACTLY, so prefix/wildcard listening is impossible
// (RESEARCH §Pattern 2). Keep this in sync when the backend adds event names.
export const KNOWN_EVENT_TYPES: readonly string[] = [
  "connected",
  "attachment.created",
  "attachment.updated",
  "attachment.deleted",
  "borrower.archived",
  "borrower.created",
  "borrower.deleted",
  "borrower.restored",
  "borrower.updated",
  "category.created",
  "category.updated",
  "category.deleted",
  "company.created",
  "company.updated",
  "company.deleted",
  "container.created",
  "container.updated",
  "container.deleted",
  "inventory.created",
  "inventory.updated",
  "inventory.deleted",
  "inventory.marked_used",
  "item.created",
  "item.updated",
  "item.deleted",
  "item_photo.created",
  "item_photo.updated",
  "item_photo.deleted",
  "item_photo.reordered",
  "item_photos.bulk_deleted",
  "item_photos.bulk_updated",
  "label.created",
  "label.updated",
  "label.deleted",
  "loan.created",
  "loan.updated",
  "loan.returned",
  "location.created",
  "location.updated",
  "location.deleted",
  "maintenance.deleted",
  "pendingchange.created",
  "pendingchange.approved",
  "pendingchange.rejected",
  "repairattachment.created",
  "repairattachment.deleted",
  "repairlog.created",
  "repairlog.started",
  "repairlog.completed",
  "repairlog.updated",
  "repairlog.deleted",
  "repair_photo.created",
  "repair_photo.updated",
  "repair_photo.deleted",
  "wishlist.deleted",
];

/**
 * Pure resolver: lowercases `entityType` (handles the "ITEM" outlier) and returns
 * the query-key prefixes to invalidate, or `[]` for an unknown type — making an
 * unrecognised entity_type a forward-compatible no-op.
 */
export function prefixesFor(
  entityType: string,
): readonly (readonly unknown[])[] {
  return INVALIDATION_MAP[entityType.toLowerCase()] ?? [];
}
