import { apiClient } from "./client";
import type { Item, ItemListResponse, ItemCreate, ItemUpdate, ItemLabelsResponse } from "../types/items";

export const itemsApi = {
  /**
   * List items with pagination
   */
  list: async (params?: { page?: number; limit?: number }): Promise<ItemListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/items${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<ItemListResponse>(url);
  },

  /**
   * Search items by query
   */
  search: async (query: string, limit?: number): Promise<Item[]> => {
    const queryParams = new URLSearchParams({ q: query });
    if (limit) queryParams.append("limit", limit.toString());

    const response = await apiClient.get<ItemListResponse>(`/items/search?${queryParams.toString()}`);
    return response.items;
  },

  /**
   * Get a single item by ID
   */
  get: async (id: string): Promise<Item> => {
    return apiClient.get<Item>(`/items/${id}`);
  },

  /**
   * List items by category
   */
  listByCategory: async (categoryId: string, params?: { page?: number; limit?: number }): Promise<Item[]> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/items/by-category/${categoryId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get<ItemListResponse>(url);
    return response.items;
  },

  /**
   * Create a new item
   */
  create: async (data: ItemCreate): Promise<Item> => {
    return apiClient.post<Item>("/items", data);
  },

  /**
   * Update an existing item
   */
  update: async (id: string, data: ItemUpdate): Promise<Item> => {
    return apiClient.patch<Item>(`/items/${id}`, data);
  },

  /**
   * Archive an item (soft delete)
   */
  archive: async (id: string): Promise<void> => {
    return apiClient.post(`/items/${id}/archive`);
  },

  /**
   * Restore an archived item
   */
  restore: async (id: string): Promise<void> => {
    return apiClient.post(`/items/${id}/restore`);
  },

  /**
   * Get labels attached to an item
   */
  getLabels: async (id: string): Promise<string[]> => {
    const response = await apiClient.get<ItemLabelsResponse>(`/items/${id}/labels`);
    return response.label_ids;
  },

  /**
   * Attach a label to an item
   */
  attachLabel: async (itemId: string, labelId: string): Promise<void> => {
    return apiClient.post(`/items/${itemId}/labels/${labelId}`);
  },

  /**
   * Detach a label from an item
   */
  detachLabel: async (itemId: string, labelId: string): Promise<void> => {
    return apiClient.delete(`/items/${itemId}/labels/${labelId}`);
  },
};
