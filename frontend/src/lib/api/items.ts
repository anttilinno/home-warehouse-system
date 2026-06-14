import { del, get, HttpError, patch, post } from "@/lib/api";
import type { Item, ItemListResponse } from "@/lib/types";
import { toProxyUrl } from "./url";

// Phase 7 Plan 01 — typed itemsApi over api.ts. Single typed boundary so feature
// plans never hand-roll fetch calls and never see absolute backend photo URLs.

// List filter params. All optional; empty/undefined values are omitted from the
// query string (backend has NO location_id filter — 07-RESEARCH Open Q1).
export interface ItemListParams {
  search?: string;
  category_id?: string;
  archived?: boolean;
  sort?: string;
  sort_dir?: string;
  page?: number;
  limit?: number;
}

// Rewrite the two absolute primary-photo URLs an ItemResponse may carry to
// /api-relative before any consumer sees them (Pitfall 1). Returns a new object;
// leaves absent fields absent (does NOT inject defaults — Pitfall 4/7).
function mapItem(raw: Item): Item {
  const mapped: Item = { ...raw };
  if (raw.primary_photo_url) {
    mapped.primary_photo_url = toProxyUrl(raw.primary_photo_url);
  }
  if (raw.primary_photo_thumbnail_url) {
    mapped.primary_photo_thumbnail_url = toProxyUrl(
      raw.primary_photo_thumbnail_url,
    );
  }
  return mapped;
}

function buildQuery(params: ItemListParams): string {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.category_id) qs.set("category_id", params.category_id);
  if (params.archived) qs.set("archived", "true");
  if (params.sort) qs.set("sort", params.sort);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return qs.toString();
}

export const itemsApi = {
  list(wsId: string, params: ItemListParams): Promise<ItemListResponse> {
    const qs = buildQuery(params);
    const suffix = qs ? `?${qs}` : "";
    return get<ItemListResponse>(`/workspaces/${wsId}/items${suffix}`).then(
      (res) => ({ ...res, items: res.items.map(mapItem) }),
    );
  },

  get(wsId: string, id: string): Promise<Item> {
    return get<Item>(`/workspaces/${wsId}/items/${id}`).then(mapItem);
  },

  create(wsId: string, data: Record<string, unknown>): Promise<Item> {
    return post<Item>(`/workspaces/${wsId}/items`, data).then(mapItem);
  },

  // PATCH: omitted keys = unchanged, "" = clear string fields (Pitfall 4). The
  // caller owns the exact body; this mapper injects no defaults.
  update(
    wsId: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Item> {
    return patch<Item>(`/workspaces/${wsId}/items/${id}`, data).then(mapItem);
  },

  archive(wsId: string, id: string): Promise<void> {
    return post<void>(`/workspaces/${wsId}/items/${id}/archive`);
  },

  restore(wsId: string, id: string): Promise<void> {
    return post<void>(`/workspaces/${wsId}/items/${id}/restore`);
  },

  del(wsId: string, id: string): Promise<void> {
    return del<void>(`/workspaces/${wsId}/items/${id}`);
  },

  // ITEM-09 — re-added per the locked Phase 65 pattern. encodeURIComponent the
  // barcode (path-injection guard T-07-02); NO client-side case normalization
  // (server is the case-sensitive authority — Phase 65 D-07). 404 → null; every
  // other error (incl. 500) rethrows so it surfaces.
  async lookupByBarcode(wsId: string, code: string): Promise<Item | null> {
    try {
      const item = await get<Item>(
        `/workspaces/${wsId}/items/by-barcode/${encodeURIComponent(code)}`,
      );
      return mapItem(item);
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
  },
};
