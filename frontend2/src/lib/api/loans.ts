import { get, post, patch } from "@/lib/api";

// Embedded decoration objects populated by the backend (Plan 62-01, D-03/D-04)
export interface LoanEmbeddedItem {
  id: string;
  name: string;
  primary_photo_thumbnail_url?: string | null;
}

export interface LoanEmbeddedBorrower {
  id: string;
  name: string;
}

export interface Loan {
  id: string;
  workspace_id: string;
  inventory_id: string;
  borrower_id: string;
  quantity: number;
  loaned_at: string;
  due_date?: string | null;
  returned_at?: string | null;
  notes?: string | null;
  is_active: boolean;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  item: LoanEmbeddedItem;
  borrower: LoanEmbeddedBorrower;
}

export interface LoanListResponse {
  items: Loan[];
}

export interface LoanListParams {
  page?: number;
  limit?: number;
  active?: boolean;
  overdue?: boolean;
  borrower_id?: string;
}

export interface CreateLoanInput {
  inventory_id: string;
  borrower_id: string;
  quantity: number;
  loaned_at?: string;
  due_date?: string;
  notes?: string;
}

/**
 * @deprecated Phase 62 D-01: use `loansApi.update` instead. `extend` remains available
 * for backward compatibility with any non-panel caller; do NOT wire new UI code to it.
 */
export interface ExtendLoanInput {
  new_due_date: string;
}

export interface UpdateLoanInput {
  due_date?: string;
  notes?: string;
}

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const base = (wsId: string) => `/workspaces/${wsId}/loans`;

export const loansApi = {
  list: (wsId: string, params: LoanListParams = {}) =>
    get<LoanListResponse>(`${base(wsId)}${toQuery(params as Record<string, unknown>)}`),
  listActive: (wsId: string) => get<LoanListResponse>(`${base(wsId)}/active`),
  listOverdue: (wsId: string) => get<LoanListResponse>(`${base(wsId)}/overdue`),
  listForBorrower: (wsId: string, borrowerId: string) =>
    get<LoanListResponse>(`/workspaces/${wsId}/borrowers/${borrowerId}/loans`),
  /** D-05: lists loans for a given inventory item (active + historical in one response). */
  listForItem: (wsId: string, inventoryId: string) =>
    get<LoanListResponse>(`/workspaces/${wsId}/inventory/${inventoryId}/loans`),
  get: (wsId: string, id: string) => get<Loan>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateLoanInput) => post<Loan>(base(wsId), body),
  /** D-02: unified PATCH replacing the old extend/update-notes split for edit flows. */
  update: (wsId: string, id: string, body: UpdateLoanInput) =>
    patch<Loan>(`${base(wsId)}/${id}`, body),
  /** @deprecated Phase 62 D-01: use `update` instead. */
  extend: (wsId: string, id: string, body: ExtendLoanInput) =>
    patch<Loan>(`${base(wsId)}/${id}/extend`, body),
  return: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/return`),
};

export const loanKeys = {
  all: ["loans"] as const,
  lists: () => [...loanKeys.all, "list"] as const,
  list: (params: LoanListParams) => [...loanKeys.lists(), params] as const,
  details: () => [...loanKeys.all, "detail"] as const,
  detail: (id: string) => [...loanKeys.details(), id] as const,
  /** D-06: key for the per-item loans fetch. */
  forItem: (inventoryId: string) => [...loanKeys.all, "forItem", inventoryId] as const,
  /** D-06: key for the per-borrower loans fetch (kept symmetrical even though it was implied by `listForBorrower`). */
  forBorrower: (borrowerId: string) => [...loanKeys.all, "forBorrower", borrowerId] as const,
};
