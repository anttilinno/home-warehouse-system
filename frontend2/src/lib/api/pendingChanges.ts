import { get } from "@/lib/api";

// Phase 13 Plan 02 — workspace-scoped pending-changes api (DASH-03 side rail).
// `GET /api/workspaces/{ws}/pending-changes` is owner/admin-only (the handler
// calls canReviewChanges → huma.Error403Forbidden for everyone else). The list
// envelope is BARE { changes, total } — the key is `changes`, NOT `items`
// (verified pendingchange/handler.go:381-382). The dashboard panel only reads
// `total` for the side-rail count.

// PendingChangeDTO — typed only for the JSON fields a consumer surfaces (a
// subset of PendingChangeResponse; ReviewedBy/Payload/etc. are intentionally
// omitted — the side-rail card needs none of them).
export interface PendingChangeDTO {
  id: string;
  workspace_id: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  entity_type: string;
  entity_id?: string | null;
  action: "create" | "update" | "delete";
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export const pendingChangesApi = {
  // Owner/admin-only list. Optional `status` narrows server-side
  // (pending|approved|rejected). Returns { changes, total } — a 403 for
  // non-admins surfaces as an HttpError(403) the caller degrades on.
  list: (ws: string, opts?: { status?: string }) => {
    const qs = opts?.status ? `?status=${encodeURIComponent(opts.status)}` : "";
    return get<{ changes: PendingChangeDTO[]; total: number }>(
      `/workspaces/${ws}/pending-changes${qs}`,
    );
  },
};
