import { del, get, patch, post } from "@/lib/api";
import type { Label } from "@/lib/types";

// Phase 7 Plan 01 — read + attach/detach label helpers. The label list is a
// workspace resource; item↔label links are attach/detach by id.
//
// Phase 10 Plan 01 (TAX-07) — EXTENDED with the label-manager CRUD surface
// (get/create/update/archive/restore/del). The label LIST is a BARE { items }
// envelope (label/handler.go:34-36,269-271 — Pitfall 2: no `.total`); color is
// a nullable hex string validated `^#[0-9A-Fa-f]{6}$` server-side
// (handler.go:280). The existing read/attach/detach helpers are unchanged.

// CreateLabelBody — label/handler.go:277-283. color optional hex; omit when empty.
export interface CreateLabelBody {
  name: string; // required 1..255
  color?: string; // hex ^#[0-9A-Fa-f]{6}$ (omit when no color)
  description?: string;
}

// All-optional PATCH (handler.go all-optional update).
export type UpdateLabelBody = Partial<CreateLabelBody>;

export const labelsApi = {
  // GET /items/{id}/labels → { label_ids: string[] }.
  getItemLabelIds(wsId: string, itemId: string): Promise<string[]> {
    return get<{ label_ids: string[] }>(
      `/workspaces/${wsId}/items/${itemId}/labels`,
    ).then((res) => res.label_ids);
  },

  attach(wsId: string, itemId: string, labelId: string): Promise<void> {
    return post<void>(`/workspaces/${wsId}/items/${itemId}/labels/${labelId}`);
  },

  detach(wsId: string, itemId: string, labelId: string): Promise<void> {
    return del<void>(`/workspaces/${wsId}/items/${itemId}/labels/${labelId}`);
  },

  // GET /labels → { items: LabelResponse[] }.
  listWorkspaceLabels(wsId: string): Promise<Label[]> {
    return get<{ items: Label[] }>(`/workspaces/${wsId}/labels`).then(
      (res) => res.items,
    );
  },

  // --- TAX-07 manager surface (Phase 10 Plan 01) ---

  get(wsId: string, id: string): Promise<Label> {
    return get<Label>(`/workspaces/${wsId}/labels/${id}`);
  },
  create(wsId: string, body: CreateLabelBody): Promise<Label> {
    return post<Label>(`/workspaces/${wsId}/labels`, body);
  },
  update(wsId: string, id: string, body: UpdateLabelBody): Promise<Label> {
    return patch<Label>(`/workspaces/${wsId}/labels/${id}`, body);
  },
  archive(wsId: string, id: string): Promise<void> {
    return post<void>(`/workspaces/${wsId}/labels/${id}/archive`);
  },
  restore(wsId: string, id: string): Promise<void> {
    return post<void>(`/workspaces/${wsId}/labels/${id}/restore`);
  },
  del(wsId: string, id: string): Promise<void> {
    return del<void>(`/workspaces/${wsId}/labels/${id}`);
  },
};
