import { apiClient } from "./client";
import type {
  Location,
  LocationListResponse,
  LocationCreate,
  LocationUpdate,
  BreadcrumbResponse
} from "../types/locations";

export const locationsApi = {
  /**
   * List locations with pagination
   */
  list: async (workspaceId: string, params?: { page?: number; limit?: number }): Promise<LocationListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/locations${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<LocationListResponse>(url);
  },

  /**
   * Search locations by query
   */
  search: async (workspaceId: string, query: string, limit?: number): Promise<Location[]> => {
    const queryParams = new URLSearchParams({ q: query });
    if (limit) queryParams.append("limit", limit.toString());

    try {
      const response = await apiClient.get<LocationListResponse>(
        `/workspaces/${workspaceId}/locations/search?${queryParams.toString()}`
      );
      return response.items;
    } catch (error: any) {
      // If endpoint doesn't exist (404), return empty array
      if (error?.status === 404) {
        console.warn("Locations search endpoint not yet implemented");
        return [];
      }
      throw error;
    }
  },

  /**
   * Get a single location by ID
   */
  get: async (workspaceId: string, id: string): Promise<Location> => {
    return apiClient.get<Location>(`/workspaces/${workspaceId}/locations/${id}`);
  },

  /**
   * Create a new location
   */
  create: async (workspaceId: string, data: LocationCreate): Promise<Location> => {
    return apiClient.post<Location>(`/workspaces/${workspaceId}/locations`, data);
  },

  /**
   * Update an existing location
   */
  update: async (workspaceId: string, id: string, data: LocationUpdate): Promise<Location> => {
    return apiClient.patch<Location>(`/workspaces/${workspaceId}/locations/${id}`, data);
  },

  /**
   * Archive a location (soft delete)
   */
  archive: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.post(`/workspaces/${workspaceId}/locations/${id}/archive`);
  },

  /**
   * Restore an archived location
   */
  restore: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.post(`/workspaces/${workspaceId}/locations/${id}/restore`);
  },

  /**
   * Delete a location permanently
   */
  delete: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.delete(`/workspaces/${workspaceId}/locations/${id}`);
  },

  /**
   * Get breadcrumb trail for a location
   */
  getBreadcrumb: async (workspaceId: string, id: string): Promise<BreadcrumbResponse> => {
    return apiClient.get<BreadcrumbResponse>(`/workspaces/${workspaceId}/locations/${id}/breadcrumb`);
  },
};
