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
   * Get a single inventory by ID
   */
  get: async (id: string): Promise<Inventory> => {
    return apiClient.get<Inventory>(`/inventory/${id}`);
  },

  /**
   * List inventory by item ID
   */
  listByItem: async (itemId: string): Promise<Inventory[]> => {
    const response = await apiClient.get<InventoryListResponse>(`/inventory/by-item/${itemId}`);
    return response.items;
  },

  /**
   * List inventory by location ID
   */
  listByLocation: async (locationId: string): Promise<Inventory[]> => {
    const response = await apiClient.get<InventoryListResponse>(`/inventory/by-location/${locationId}`);
    return response.items;
  },

  /**
   * List inventory by container ID
   */
  listByContainer: async (containerId: string): Promise<Inventory[]> => {
    const response = await apiClient.get<InventoryListResponse>(`/inventory/by-container/${containerId}`);
    return response.items;
  },

  /**
   * Get available inventory for an item
   */
  getAvailable: async (itemId: string): Promise<Inventory[]> => {
    const response = await apiClient.get<InventoryListResponse>(`/inventory/available/${itemId}`);
    return response.items;
  },

  /**
   * Get total quantity for an item
   */
  getTotalQuantity: async (itemId: string): Promise<TotalQuantityResponse> => {
    return apiClient.get<TotalQuantityResponse>(`/inventory/total-quantity/${itemId}`);
  },

  /**
   * Create a new inventory entry
   */
  create: async (data: InventoryCreate): Promise<Inventory> => {
    return apiClient.post<Inventory>("/inventory", data);
  },

  /**
   * Update an existing inventory entry
   */
  update: async (id: string, data: InventoryUpdate): Promise<Inventory> => {
    return apiClient.patch<Inventory>(`/inventory/${id}`, data);
  },

  /**
   * Update inventory status
   */
  updateStatus: async (id: string, data: InventoryStatusUpdate): Promise<Inventory> => {
    return apiClient.patch<Inventory>(`/inventory/${id}/status`, data);
  },

  /**
   * Update inventory quantity
   */
  updateQuantity: async (id: string, data: InventoryQuantityUpdate): Promise<Inventory> => {
    return apiClient.patch<Inventory>(`/inventory/${id}/quantity`, data);
  },

  /**
   * Move inventory to a new location/container
   */
  move: async (id: string, data: InventoryMove): Promise<Inventory> => {
    return apiClient.post<Inventory>(`/inventory/${id}/move`, data);
  },

  /**
   * Archive an inventory entry
   */
  archive: async (id: string): Promise<void> => {
    return apiClient.post(`/inventory/${id}/archive`);
  },

  /**
   * Restore an archived inventory entry
   */
  restore: async (id: string): Promise<void> => {
    return apiClient.post(`/inventory/${id}/restore`);
  },
};
