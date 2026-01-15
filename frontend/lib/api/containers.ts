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
  list: async (params?: { page?: number; limit?: number }): Promise<ContainerListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/containers${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<ContainerListResponse>(url);
  },

  /**
   * Get a single container by ID
   */
  get: async (id: string): Promise<Container> => {
    return apiClient.get<Container>(`/containers/${id}`);
  },

  /**
   * Create a new container
   */
  create: async (data: ContainerCreate): Promise<Container> => {
    return apiClient.post<Container>("/containers", data);
  },

  /**
   * Update an existing container
   */
  update: async (id: string, data: ContainerUpdate): Promise<Container> => {
    return apiClient.patch<Container>(`/containers/${id}`, data);
  },

  /**
   * Archive a container (soft delete)
   */
  archive: async (id: string): Promise<void> => {
    return apiClient.post(`/containers/${id}/archive`);
  },

  /**
   * Restore an archived container
   */
  restore: async (id: string): Promise<void> => {
    return apiClient.post(`/containers/${id}/restore`);
  },

  /**
   * Delete a container permanently
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/containers/${id}`);
  },
};
