import { apiClient } from "./client";
import type {
  Container,
  ContainerListResponse,
  ContainerCreate,
  ContainerUpdate,
} from "../types/containers";

export const containersApi = {
  /**
   * List containers with pagination
   */
  list: async (workspaceId: string, params?: { page?: number; limit?: number }): Promise<ContainerListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/containers${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<ContainerListResponse>(url);
  },

  /**
   * Search containers by query
   */
  search: async (workspaceId: string, query: string, limit?: number): Promise<Container[]> => {
    const queryParams = new URLSearchParams({ q: query });
    if (limit) queryParams.append("limit", limit.toString());

    try {
      const response = await apiClient.get<ContainerListResponse>(
        `/workspaces/${workspaceId}/containers/search?${queryParams.toString()}`
      );
      return response.items;
    } catch (error: any) {
      // If endpoint doesn't exist (404), return empty array
      if (error?.status === 404) {
        console.warn("Containers search endpoint not yet implemented");
        return [];
      }
      throw error;
    }
  },

  /**
   * Get a single container by ID
   */
  get: async (workspaceId: string, id: string): Promise<Container> => {
    return apiClient.get<Container>(`/workspaces/${workspaceId}/containers/${id}`);
  },

  /**
   * Create a new container
   */
  create: async (workspaceId: string, data: ContainerCreate): Promise<Container> => {
    return apiClient.post<Container>(`/workspaces/${workspaceId}/containers`, data);
  },

  /**
   * Update an existing container
   */
  update: async (workspaceId: string, id: string, data: ContainerUpdate): Promise<Container> => {
    return apiClient.patch<Container>(`/workspaces/${workspaceId}/containers/${id}`, data);
  },

  /**
   * Archive a container (soft delete)
   */
  archive: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.post(`/workspaces/${workspaceId}/containers/${id}/archive`);
  },

  /**
   * Restore an archived container
   */
  restore: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.post(`/workspaces/${workspaceId}/containers/${id}/restore`);
  },

  /**
   * Delete a container permanently
   */
  delete: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.delete(`/workspaces/${workspaceId}/containers/${id}`);
  },
};
