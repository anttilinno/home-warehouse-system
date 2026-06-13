import { get } from "@/lib/api";
import type { PendingChangeDTO } from "@/lib/api/pendingChanges";

// Phase 14 Plan 02 — SYS-02 my-changes api. `GET /api/workspaces/{ws}/my-pending-changes`
// returns ONLY the caller's own pending changes (the handler fetches
// FindByRequester(authUser.ID) then filters to the workspace) — every role may
// call it (NO 403 gate, unlike /pending-changes). The list envelope is the BARE
// { changes, total } shape (key `changes`, NOT items — identical to
// /pending-changes, verified pendingchange/handler.go:175-180).
//
// This module is intentionally isolated from pendingChanges.ts at RUNTIME (it
// reaches a DIFFERENT endpoint and is owned by THIS plan); it borrows only the
// PendingChangeDTO TYPE to avoid field drift.

// MyChangeDTO — the subset of PendingChangeResponse the activity table surfaces.
// The requester is always the caller, so requester_* fields are omitted.
export interface MyChangeDTO {
  id: string;
  entity_type: string;
  entity_id?: string | null;
  action: PendingChangeDTO["action"];
  status: PendingChangeDTO["status"];
  created_at: string;
}

export const myChangesApi = {
  // The caller's own changes. Returns { changes, total } — no 403 path (open to
  // all roles); an empty result is a normal { changes: [], total: 0 } body.
  list: (ws: string) =>
    get<{ changes: MyChangeDTO[]; total: number }>(
      `/workspaces/${ws}/my-pending-changes`,
    ),
};
