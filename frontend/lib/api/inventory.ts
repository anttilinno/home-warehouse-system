import { apiClient } from "./client";
import type {
  Inventory,
  InventoryListResponse,
  InventoryCreate,
  InventoryUpdate,
  InventoryStatusUpdate,
  InventoryQuantityUpdate,
  InventoryMove,
  TotalQuantityResponse,
} from "../types/inventory";

export const inventoryApi = {
  /**
   * List inventory with pagination
   */
  list: async (workspaceId: string, params?: { page?: number; limit?: number }): Promise<InventoryListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/inventory${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<InventoryListResponse>(url);
  },

  /**
   * Get a single inventory by ID
   */
  get: async (workspaceId: string, id: string): Promise<Inventory> => {
    return apiClient.get<Inventory>(`/workspaces/${workspaceId}/inventory/${id}`);
  },

  /**
   * List inventory by item ID
   */
  listByItem: async (workspaceId: string, itemId: string): Promise<Inventory[]> => {
    const response = await apiClient.get<InventoryListResponse>(`/workspaces/${workspaceId}/inventory/by-item/${itemId}`);
    return response.items;
  },

  /**
   * List inventory by location ID
   */
  listByLocation: async (workspaceId: string, locationId: string): Promise<Inventory[]> => {
    const response = await apiClient.get<InventoryListResponse>(`/workspaces/${workspaceId}/inventory/by-location/${locationId}`);
    return response.items;
  },

  /**
   * List inventory by container ID
   */
  listByContainer: async (workspaceId: string, containerId: string): Promise<Inventory[]> => {
    const response = await apiClient.get<InventoryListResponse>(`/workspaces/${workspaceId}/inventory/by-container/${containerId}`);
    return response.items;
  },

  /**
   * Get available inventory for an item
   */
  getAvailable: async (workspaceId: string, itemId: string): Promise<Inventory[]> => {
    const response = await apiClient.get<InventoryListResponse>(`/workspaces/${workspaceId}/inventory/available/${itemId}`);
    return response.items;
  },

  /**
   * Get total quantity for an item
   */
  getTotalQuantity: async (workspaceId: string, itemId: string): Promise<TotalQuantityResponse> => {
    return apiClient.get<TotalQuantityResponse>(`/workspaces/${workspaceId}/inventory/total-quantity/${itemId}`);
  },

  /**
   * Create a new inventory entry
   */
  create: async (workspaceId: string, data: InventoryCreate): Promise<Inventory> => {
    return apiClient.post<Inventory>(`/workspaces/${workspaceId}/inventory`, data);
  },

  /**
   * Update an existing inventory entry
   */
  update: async (workspaceId: string, id: string, data: InventoryUpdate): Promise<Inventory> => {
    return apiClient.patch<Inventory>(`/workspaces/${workspaceId}/inventory/${id}`, data);
  },

  /**
   * Update inventory status
   */
  updateStatus: async (workspaceId: string, id: string, data: InventoryStatusUpdate): Promise<Inventory> => {
    return apiClient.patch<Inventory>(`/workspaces/${workspaceId}/inventory/${id}/status`, data);
  },

  /**
   * Update inventory quantity
   */
  updateQuantity: async (workspaceId: string, id: string, data: InventoryQuantityUpdate): Promise<Inventory> => {
    return apiClient.patch<Inventory>(`/workspaces/${workspaceId}/inventory/${id}/quantity`, data);
  },

  /**
   * Move inventory to a new location/container
   */
  move: async (workspaceId: string, id: string, data: InventoryMove): Promise<Inventory> => {
    return apiClient.post<Inventory>(`/workspaces/${workspaceId}/inventory/${id}/move`, data);
  },

  /**
   * Archive an inventory entry
   */
  archive: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.post(`/workspaces/${workspaceId}/inventory/${id}/archive`);
  },

  /**
   * Restore an archived inventory entry
   */
  restore: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.post(`/workspaces/${workspaceId}/inventory/${id}/restore`);
  },
};
