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
  list: async (workspaceId: string, params?: { page?: number; limit?: number }): Promise<BorrowerListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/borrowers${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<BorrowerListResponse>(url);
  },

  /**
   * Search borrowers by query
   */
  search: async (workspaceId: string, query: string, limit?: number): Promise<Borrower[]> => {
    const queryParams = new URLSearchParams({ q: query });
    if (limit) queryParams.append("limit", limit.toString());

    try {
      const response = await apiClient.get<BorrowerListResponse>(
        `/workspaces/${workspaceId}/borrowers/search?${queryParams.toString()}`
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
  get: async (workspaceId: string, id: string): Promise<Borrower> => {
    return apiClient.get<Borrower>(`/workspaces/${workspaceId}/borrowers/${id}`);
  },

  /**
   * Create a new borrower
   */
  create: async (workspaceId: string, data: BorrowerCreate): Promise<Borrower> => {
    return apiClient.post<Borrower>(`/workspaces/${workspaceId}/borrowers`, data);
  },

  /**
   * Update an existing borrower
   */
  update: async (workspaceId: string, id: string, data: BorrowerUpdate): Promise<Borrower> => {
    return apiClient.patch<Borrower>(`/workspaces/${workspaceId}/borrowers/${id}`, data);
  },

  /**
   * Delete a borrower
   * Note: Cannot delete borrower with active loans
   */
  delete: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.delete(`/workspaces/${workspaceId}/borrowers/${id}`);
  },
};
