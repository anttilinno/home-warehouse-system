import { get, post, patch, del } from "@/lib/api";

export interface Borrower {
  id: string;
  workspace_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BorrowerListResponse {
  items: Borrower[];
}

export interface BorrowerListParams {
  page?: number;
  limit?: number;
}

export interface CreateBorrowerInput {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateBorrowerInput {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const base = (wsId: string) => `/workspaces/${wsId}/borrowers`;

export const borrowersApi = {
  list: (wsId: string, params: BorrowerListParams = {}) =>
    get<BorrowerListResponse>(`${base(wsId)}${toQuery(params as Record<string, unknown>)}`),
  get: (wsId: string, id: string) => get<Borrower>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateBorrowerInput) => post<Borrower>(base(wsId), body),
  update: (wsId: string, id: string, body: UpdateBorrowerInput) =>
    patch<Borrower>(`${base(wsId)}/${id}`, body),
  remove: (wsId: string, id: string) => del<void>(`${base(wsId)}/${id}`),
};

export const borrowerKeys = {
  all: ["borrowers"] as const,
  lists: () => [...borrowerKeys.all, "list"] as const,
  list: (params: BorrowerListParams) => [...borrowerKeys.lists(), params] as const,
  details: () => [...borrowerKeys.all, "detail"] as const,
  detail: (id: string) => [...borrowerKeys.details(), id] as const,
};
