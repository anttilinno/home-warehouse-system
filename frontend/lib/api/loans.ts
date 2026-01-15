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
  list: async (params?: { page?: number; limit?: number }): Promise<Loan[]> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/loans${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get<LoanListResponse>(url);
    return response.items;
  },

  /**
   * Get active loans (not returned)
   */
  getActive: async (): Promise<Loan[]> => {
    const response = await apiClient.get<LoanListResponse>("/loans/active");
    return response.items;
  },

  /**
   * Get overdue loans
   */
  getOverdue: async (): Promise<Loan[]> => {
    const response = await apiClient.get<LoanListResponse>("/loans/overdue");
    return response.items;
  },

  /**
   * Get a single loan by ID
   */
  get: async (id: string): Promise<Loan> => {
    return apiClient.get<Loan>(`/loans/${id}`);
  },

  /**
   * Create a new loan
   */
  create: async (data: LoanCreate): Promise<Loan> => {
    return apiClient.post<Loan>("/loans", data);
  },

  /**
   * Return a loan
   */
  return: async (id: string): Promise<Loan> => {
    return apiClient.post<Loan>(`/loans/${id}/return`);
  },

  /**
   * Extend due date for a loan
   */
  extend: async (id: string, data: LoanExtend): Promise<Loan> => {
    return apiClient.patch<Loan>(`/loans/${id}/extend`, data);
  },

  /**
   * List loans by borrower
   */
  listByBorrower: async (borrowerId: string, params?: { page?: number; limit?: number }): Promise<Loan[]> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/borrowers/${borrowerId}/loans${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get<LoanListResponse>(url);
    return response.items;
  },

  /**
   * List loans by inventory
   */
  listByInventory: async (inventoryId: string): Promise<Loan[]> => {
    const response = await apiClient.get<LoanListResponse>(`/inventory/${inventoryId}/loans`);
    return response.items;
  },
};
