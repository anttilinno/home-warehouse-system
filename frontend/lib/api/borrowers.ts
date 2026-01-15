import { apiClient } from "./client";
import type {
  Borrower,
  BorrowerListResponse,
  BorrowerCreate,
  BorrowerUpdate,
} from "../types/borrowers";

export const borrowersApi = {
  /**
   * List borrowers with pagination
   */
  list: async (params?: { page?: number; limit?: number }): Promise<BorrowerListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/borrowers${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<BorrowerListResponse>(url);
  },

  /**
   * Get a single borrower by ID
   */
  get: async (id: string): Promise<Borrower> => {
    return apiClient.get<Borrower>(`/borrowers/${id}`);
  },

  /**
   * Create a new borrower
   */
  create: async (data: BorrowerCreate): Promise<Borrower> => {
    return apiClient.post<Borrower>("/borrowers", data);
  },

  /**
   * Update an existing borrower
   */
  update: async (id: string, data: BorrowerUpdate): Promise<Borrower> => {
    return apiClient.patch<Borrower>(`/borrowers/${id}`, data);
  },

  /**
   * Archive a borrower (soft delete)
   * Note: Cannot archive borrower with active loans
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/borrowers/${id}`);
  },
};
