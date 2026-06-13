import { del, get, post } from "@/lib/api";
import type { Label } from "@/lib/types";

// Phase 7 Plan 01 — read + attach/detach label helpers. The label list is a
// workspace resource; item↔label links are attach/detach by id.

export const labelsApi = {
  // GET /items/{id}/labels → { label_ids: string[] }.
  getItemLabelIds(wsId: string, itemId: string): Promise<string[]> {
    return get<{ label_ids: string[] }>(
      `/workspaces/${wsId}/items/${itemId}/labels`,
    ).then((res) => res.label_ids);
  },

  attach(wsId: string, itemId: string, labelId: string): Promise<void> {
    return post<void>(
      `/workspaces/${wsId}/items/${itemId}/labels/${labelId}`,
    );
  },

  detach(wsId: string, itemId: string, labelId: string): Promise<void> {
    return del<void>(
      `/workspaces/${wsId}/items/${itemId}/labels/${labelId}`,
    );
  },

  // GET /labels → { items: LabelResponse[] }.
  listWorkspaceLabels(wsId: string): Promise<Label[]> {
    return get<{ items: Label[] }>(`/workspaces/${wsId}/labels`).then(
      (res) => res.items,
    );
  },
};
