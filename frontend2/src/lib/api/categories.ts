import { get, post, patch, del } from "@/lib/api";

export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  parent_category_id?: string | null;
  description?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryListResponse {
  items: Category[];
}

export interface CategoryListParams {
  page?: number;
  limit?: number;
  archived?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  parent_category_id?: string;
  description?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  parent_category_id?: string;
  description?: string;
}

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const base = (wsId: string) => `/workspaces/${wsId}/categories`;

export const categoriesApi = {
  list: (wsId: string, params: CategoryListParams = {}) =>
    get<CategoryListResponse>(`${base(wsId)}${toQuery(params as Record<string, unknown>)}`),
  listRoot: (wsId: string) => get<Category[]>(`${base(wsId)}/root`),
  listChildren: (wsId: string, id: string) => get<Category[]>(`${base(wsId)}/${id}/children`),
  breadcrumb: (wsId: string, id: string) => get<Category[]>(`${base(wsId)}/${id}/breadcrumb`),
  get: (wsId: string, id: string) => get<Category>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateCategoryInput) => post<Category>(base(wsId), body),
  update: (wsId: string, id: string, body: UpdateCategoryInput) =>
    patch<Category>(`${base(wsId)}/${id}`, body),
  archive: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/archive`),
  restore: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/restore`),
  remove: (wsId: string, id: string) => del<void>(`${base(wsId)}/${id}`),
};

export const categoryKeys = {
  all: ["categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  list: (params: CategoryListParams) => [...categoryKeys.lists(), params] as const,
  details: () => [...categoryKeys.all, "detail"] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};
