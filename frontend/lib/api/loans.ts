import { apiClient } from "./client";
import type {
  Loan,
  LoanListResponse,
  LoanCreate,
  LoanExtend,
} from "../types/loans";

export const loansApi = {
  /**
   * List all loans with pagination
   */
  list: async (workspaceId: string, params?: { page?: number; limit?: number }): Promise<LoanListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/loans${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<LoanListResponse>(url);
  },

  /**
   * Get active loans (not returned)
   */
  getActive: async (workspaceId: string): Promise<Loan[]> => {
    const response = await apiClient.get<LoanListResponse>(`/workspaces/${workspaceId}/loans/active`);
    return response.items;
  },

  /**
   * Get overdue loans
   */
  getOverdue: async (workspaceId: string): Promise<Loan[]> => {
    const response = await apiClient.get<LoanListResponse>(`/workspaces/${workspaceId}/loans/overdue`);
    return response.items;
  },

  /**
   * Get a single loan by ID
   */
  get: async (workspaceId: string, id: string): Promise<Loan> => {
    return apiClient.get<Loan>(`/workspaces/${workspaceId}/loans/${id}`);
  },

  /**
   * Create a new loan
   */
  create: async (workspaceId: string, data: LoanCreate): Promise<Loan> => {
    return apiClient.post<Loan>(`/workspaces/${workspaceId}/loans`, data);
  },

  /**
   * Return a loan
   */
  return: async (workspaceId: string, id: string): Promise<Loan> => {
    return apiClient.post<Loan>(`/workspaces/${workspaceId}/loans/${id}/return`);
  },

  /**
   * Extend due date for a loan
   */
  extend: async (workspaceId: string, id: string, data: LoanExtend): Promise<Loan> => {
    return apiClient.patch<Loan>(`/workspaces/${workspaceId}/loans/${id}/extend`, data);
  },

  /**
   * List loans by borrower
   */
  listByBorrower: async (workspaceId: string, borrowerId: string, params?: { page?: number; limit?: number }): Promise<Loan[]> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/borrowers/${borrowerId}/loans${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get<LoanListResponse>(url);
    return response.items;
  },

  /**
   * List loans by inventory
   */
  listByInventory: async (workspaceId: string, inventoryId: string): Promise<Loan[]> => {
    const response = await apiClient.get<LoanListResponse>(`/workspaces/${workspaceId}/inventory/${inventoryId}/loans`);
    return response.items;
  },
};
