import { get, post, patch, del } from "@/lib/api";

export interface Location {
  id: string;
  workspace_id: string;
  name: string;
  parent_location?: string | null;
  description?: string | null;
  short_code: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationListResponse {
  items: Location[];
  total: number;
  page: number;
  total_pages: number;
}

export interface LocationListParams {
  page?: number;
  limit?: number;
  archived?: boolean;
  search?: string;
}

export interface CreateLocationInput {
  name: string;
  parent_location?: string;
  description?: string;
  short_code?: string;
}

export interface UpdateLocationInput {
  name?: string;
  parent_location?: string;
  description?: string;
}

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const base = (wsId: string) => `/workspaces/${wsId}/locations`;

export const locationsApi = {
  list: (wsId: string, params: LocationListParams = {}) =>
    get<LocationListResponse>(`${base(wsId)}${toQuery(params as Record<string, unknown>)}`),
  breadcrumb: (wsId: string, id: string) => get<Location[]>(`${base(wsId)}/${id}/breadcrumb`),
  search: (wsId: string, q: string) =>
    get<Location[]>(`${base(wsId)}/search${toQuery({ q } as Record<string, unknown>)}`),
  get: (wsId: string, id: string) => get<Location>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateLocationInput) => post<Location>(base(wsId), body),
  update: (wsId: string, id: string, body: UpdateLocationInput) =>
    patch<Location>(`${base(wsId)}/${id}`, body),
  archive: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/archive`),
  restore: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/restore`),
  remove: (wsId: string, id: string) => del<void>(`${base(wsId)}/${id}`),
};

export const locationKeys = {
  all: ["locations"] as const,
  lists: () => [...locationKeys.all, "list"] as const,
  list: (params: LocationListParams) => [...locationKeys.lists(), params] as const,
  details: () => [...locationKeys.all, "detail"] as const,
  detail: (id: string) => [...locationKeys.details(), id] as const,
};
