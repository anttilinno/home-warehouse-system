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
  list: async (params?: { page?: number; limit?: number }): Promise<LocationListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/locations${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<LocationListResponse>(url);
  },

  /**
   * Search locations by query
   * Note: Backend endpoint not yet implemented - returns empty array on 404
   */
  search: async (query: string, limit?: number): Promise<Location[]> => {
    const queryParams = new URLSearchParams({ q: query });
    if (limit) queryParams.append("limit", limit.toString());

    try {
      const response = await apiClient.get<LocationListResponse>(
        `/locations/search?${queryParams.toString()}`
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
  get: async (id: string): Promise<Location> => {
    return apiClient.get<Location>(`/locations/${id}`);
  },

  /**
   * Create a new location
   */
  create: async (data: LocationCreate): Promise<Location> => {
    return apiClient.post<Location>("/locations", data);
  },

  /**
   * Update an existing location
   */
  update: async (id: string, data: LocationUpdate): Promise<Location> => {
    return apiClient.patch<Location>(`/locations/${id}`, data);
  },

  /**
   * Archive a location (soft delete)
   */
  archive: async (id: string): Promise<void> => {
    return apiClient.post(`/locations/${id}/archive`);
  },

  /**
   * Restore an archived location
   */
  restore: async (id: string): Promise<void> => {
    return apiClient.post(`/locations/${id}/restore`);
  },

  /**
   * Delete a location permanently
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/locations/${id}`);
  },

  /**
   * Get breadcrumb trail for a location
   */
  getBreadcrumb: async (id: string): Promise<BreadcrumbResponse> => {
    return apiClient.get<BreadcrumbResponse>(`/locations/${id}/breadcrumb`);
  },
};
