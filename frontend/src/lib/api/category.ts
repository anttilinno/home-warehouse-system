import { get, post, patch, del } from "@/lib/api";

// Phase 10 Plan 01 — categoryApi. MIRRORS lib/api/borrowers.ts structure but the
// LIST envelope is BARE { items } (category/handler.go:34-36,324-326 — verified
// 2026-06-13), NEVER a { items, total } pager (Pitfall 2: reading `.total` on a
// category list MUST be a TYPE error). Single-entity routes return a Category.
//
// Categories nest via `parent_category_id` (NOT `parent_location`-style). There
// is NO item_count on Category — TAX-02 usage warnings derive the count from a
// separate GET /items?category_id=&limit=1 paginated `.total` read.

// Backend CategoryResponse — category/handler.go:362-371. No item_count.
export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  parent_category_id?: string;
  description?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryBody {
  name: string; // required 1..255
  parent_category_id?: string; // omit (or empty) = root
  description?: string;
}

// All-optional PATCH (handler.go all-optional update).
export type UpdateCategoryBody = Partial<CreateCategoryBody>;

export const categoryApi = {
  // BARE { items } — no total (Pitfall 2). Categories list has no page/limit
  // param (returns all rows including archived — orphan handling lives in
  // buildTree, not here).
  list: (ws: string) => get<{ items: Category[] }>(`/workspaces/${ws}/categories`),
  get: (ws: string, id: string) =>
    get<Category>(`/workspaces/${ws}/categories/${id}`),
  create: (ws: string, body: CreateCategoryBody) =>
    post<Category>(`/workspaces/${ws}/categories`, body),
  update: (ws: string, id: string, body: UpdateCategoryBody) =>
    patch<Category>(`/workspaces/${ws}/categories/${id}`, body),
  archive: (ws: string, id: string) =>
    post<void>(`/workspaces/${ws}/categories/${id}/archive`),
  restore: (ws: string, id: string) =>
    post<void>(`/workspaces/${ws}/categories/${id}/restore`),
  del: (ws: string, id: string) =>
    del<void>(`/workspaces/${ws}/categories/${id}`),
};
