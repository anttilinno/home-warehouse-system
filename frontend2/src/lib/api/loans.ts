import { get, post, patch } from "@/lib/api";

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

export interface ExtendLoanInput {
  new_due_date: string;
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
  get: (wsId: string, id: string) => get<Loan>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateLoanInput) => post<Loan>(base(wsId), body),
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
};
