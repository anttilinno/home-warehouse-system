import { get, post, patch, del } from "@/lib/api";

export interface Item {
  id: string;
  workspace_id: string;
  sku: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  brand?: string | null;
  model?: string | null;
  image_url?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  barcode?: string | null;
  is_insured?: boolean | null;
  is_archived?: boolean | null;
  lifetime_warranty?: boolean | null;
  needs_review?: boolean | null;
  warranty_details?: string | null;
  purchased_from?: string | null;
  min_stock_level: number;
  short_code: string;
  obsidian_vault_path?: string | null;
  obsidian_note_path?: string | null;
  obsidian_uri?: string | null;
  // Primary photo (decorative) — backend decorates list + detail responses
  // with these when the item has a primary photo; undefined otherwise.
  primary_photo_thumbnail_url?: string | null;
  primary_photo_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  total_pages: number;
}

export interface ItemListParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  archived?: boolean;
  sort?: "name" | "sku" | "created_at" | "updated_at";
  sort_dir?: "asc" | "desc";
}

export interface CreateItemInput {
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  category_id?: string;
  brand?: string;
  model?: string;
  image_url?: string;
  serial_number?: string;
  manufacturer?: string;
  is_insured?: boolean;
  lifetime_warranty?: boolean;
  warranty_details?: string;
  purchased_from?: string;
  min_stock_level?: number;
  short_code?: string;
  obsidian_vault_path?: string;
  obsidian_note_path?: string;
  needs_review?: boolean;
}

export type UpdateItemInput = Partial<CreateItemInput>;

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const base = (wsId: string) => `/workspaces/${wsId}/items`;

export const itemsApi = {
  list: (wsId: string, params: ItemListParams = {}) =>
    get<ItemListResponse>(`${base(wsId)}${toQuery(params as Record<string, unknown>)}`),
  get: (wsId: string, id: string) => get<Item>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateItemInput) => post<Item>(base(wsId), body),
  update: (wsId: string, id: string, body: UpdateItemInput) =>
    patch<Item>(`${base(wsId)}/${id}`, body),
  archive: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/archive`),
  restore: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/restore`),
  delete: (wsId: string, id: string) => del<void>(`${base(wsId)}/${id}`),
  /**
   * D-06: Wraps itemsApi.list(wsId, { search: code, limit: 1 }) — no new HTTP endpoint.
   * D-07: Case-sensitive exact-barcode guard. Empty list OR guard-fail returns null.
   * D-08: Workspace defense-in-depth (Pitfall #5 — globally-unique UPCs guarantee
   *       cross-tenant collisions). On workspace_id mismatch, logs structured
   *       console.error and returns null.
   */
  lookupByBarcode: async (wsId: string, code: string): Promise<Item | null> => {
    const res = await itemsApi.list(wsId, { search: code, limit: 1 });
    const candidate = res.items[0];
    if (!candidate) return null;
    if (candidate.barcode !== code) return null;
    if (candidate.workspace_id !== wsId) {
      console.error({
        kind: "scan-workspace-mismatch",
        code,
        returnedWs: candidate.workspace_id,
        sessionWs: wsId,
      });
      return null;
    }
    return candidate;
  },
};

export const itemKeys = {
  all: ["items"] as const,
  lists: () => [...itemKeys.all, "list"] as const,
  list: (params: ItemListParams) => [...itemKeys.lists(), params] as const,
  details: () => [...itemKeys.all, "detail"] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const,
};
