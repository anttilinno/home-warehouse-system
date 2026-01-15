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
   * Search borrowers by query
   * Note: Backend endpoint not yet implemented - returns empty array on 404
   */
  search: async (query: string, limit?: number): Promise<Borrower[]> => {
    const queryParams = new URLSearchParams({ q: query });
    if (limit) queryParams.append("limit", limit.toString());

    try {
      const response = await apiClient.get<BorrowerListResponse>(
        `/borrowers/search?${queryParams.toString()}`
      );
      return response.items;
    } catch (error: any) {
      // If endpoint doesn't exist (404), return empty array
      if (error?.status === 404) {
        console.warn("Borrowers search endpoint not yet implemented");
        return [];
      }
      throw error;
    }
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
