import { apiClient } from "./client";
import type { Item, ItemListResponse, ItemCreate, ItemUpdate, ItemLabelsResponse } from "../types/items";

export const itemsApi = {
  /**
   * List items with pagination
   */
  list: async (workspaceId: string, params?: { page?: number; limit?: number }): Promise<ItemListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/items${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<ItemListResponse>(url);
  },

  /**
   * Search items by query
   */
  search: async (workspaceId: string, query: string, limit?: number): Promise<Item[]> => {
    const queryParams = new URLSearchParams({ q: query });
    if (limit) queryParams.append("limit", limit.toString());

    const response = await apiClient.get<ItemListResponse>(`/workspaces/${workspaceId}/items/search?${queryParams.toString()}`);
    return response.items;
  },

  /**
   * Get a single item by ID
   */
  get: async (workspaceId: string, id: string): Promise<Item> => {
    return apiClient.get<Item>(`/workspaces/${workspaceId}/items/${id}`);
  },

  /**
   * List items by category
   */
  listByCategory: async (workspaceId: string, categoryId: string, params?: { page?: number; limit?: number }): Promise<Item[]> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/items/by-category/${categoryId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get<ItemListResponse>(url);
    return response.items;
  },

  /**
   * Create a new item
   */
  create: async (workspaceId: string, data: ItemCreate): Promise<Item> => {
    return apiClient.post<Item>(`/workspaces/${workspaceId}/items`, data);
  },

  /**
   * Update an existing item
   */
  update: async (workspaceId: string, id: string, data: ItemUpdate): Promise<Item> => {
    return apiClient.patch<Item>(`/workspaces/${workspaceId}/items/${id}`, data);
  },

  /**
   * Archive an item (soft delete)
   */
  archive: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.post(`/workspaces/${workspaceId}/items/${id}/archive`);
  },

  /**
   * Restore an archived item
   */
  restore: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.post(`/workspaces/${workspaceId}/items/${id}/restore`);
  },

  /**
   * Get labels attached to an item
   */
  getLabels: async (workspaceId: string, id: string): Promise<string[]> => {
    const response = await apiClient.get<ItemLabelsResponse>(`/workspaces/${workspaceId}/items/${id}/labels`);
    return response.label_ids;
  },

  /**
   * Attach a label to an item
   */
  attachLabel: async (workspaceId: string, itemId: string, labelId: string): Promise<void> => {
    return apiClient.post(`/workspaces/${workspaceId}/items/${itemId}/labels/${labelId}`);
  },

  /**
   * Detach a label from an item
   */
  detachLabel: async (workspaceId: string, itemId: string, labelId: string): Promise<void> => {
    return apiClient.delete(`/workspaces/${workspaceId}/items/${itemId}/labels/${labelId}`);
  },
};
