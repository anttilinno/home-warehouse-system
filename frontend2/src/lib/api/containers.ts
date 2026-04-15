import { get, post, patch, del } from "@/lib/api";

export interface Container {
  id: string;
  workspace_id: string;
  name: string;
  location_id: string;
  description?: string | null;
  capacity?: string | null;
  short_code: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContainerListResponse {
  items: Container[];
  total: number;
  page: number;
  total_pages: number;
}

export interface ContainerListParams {
  page?: number;
  limit?: number;
  location_id?: string;
  archived?: boolean;
}

export interface CreateContainerInput {
  name: string;
  location_id: string;
  description?: string;
  capacity?: string;
  short_code?: string;
}

export interface UpdateContainerInput {
  name?: string;
  location_id?: string;
  description?: string;
  capacity?: string;
}

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const base = (wsId: string) => `/workspaces/${wsId}/containers`;

export const containersApi = {
  list: (wsId: string, params: ContainerListParams = {}) =>
    get<ContainerListResponse>(`${base(wsId)}${toQuery(params as Record<string, unknown>)}`),
  get: (wsId: string, id: string) => get<Container>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateContainerInput) => post<Container>(base(wsId), body),
  update: (wsId: string, id: string, body: UpdateContainerInput) =>
    patch<Container>(`${base(wsId)}/${id}`, body),
  archive: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/archive`),
  restore: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/restore`),
  remove: (wsId: string, id: string) => del<void>(`${base(wsId)}/${id}`),
};

export const containerKeys = {
  all: ["containers"] as const,
  lists: () => [...containerKeys.all, "list"] as const,
  list: (params: ContainerListParams) => [...containerKeys.lists(), params] as const,
  details: () => [...containerKeys.all, "detail"] as const,
  detail: (id: string) => [...containerKeys.details(), id] as const,
};
