import { apiClient } from "./client";
import type {
  RepairLog,
  RepairLogListResponse,
  RepairLogCreate,
  RepairLogUpdate,
  RepairLogComplete,
  RepairStatus,
} from "../types/repair-log";

export const repairLogsApi = {
  /**
   * List all repair logs in workspace
   */
  list: async (
    workspaceId: string,
    params?: { page?: number; limit?: number; status?: RepairStatus }
  ): Promise<RepairLogListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.status) queryParams.append("status", params.status);

    const url = `/workspaces/${workspaceId}/repairs${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<RepairLogListResponse>(url);
  },

  /**
   * Get repair logs for a specific inventory item
   */
  listByInventory: async (
    workspaceId: string,
    inventoryId: string
  ): Promise<RepairLog[]> => {
    const response = await apiClient.get<RepairLogListResponse>(
      `/workspaces/${workspaceId}/inventory/${inventoryId}/repairs`
    );
    return response.items;
  },

  /**
   * Get a single repair log by ID
   */
  get: async (workspaceId: string, id: string): Promise<RepairLog> => {
    return apiClient.get<RepairLog>(`/workspaces/${workspaceId}/repairs/${id}`);
  },

  /**
   * Create a new repair log
   */
  create: async (workspaceId: string, data: RepairLogCreate): Promise<RepairLog> => {
    return apiClient.post<RepairLog>(`/workspaces/${workspaceId}/repairs`, data);
  },

  /**
   * Update repair log details
   */
  update: async (
    workspaceId: string,
    id: string,
    data: RepairLogUpdate
  ): Promise<RepairLog> => {
    return apiClient.patch<RepairLog>(`/workspaces/${workspaceId}/repairs/${id}`, data);
  },

  /**
   * Start a repair (pending -> in_progress)
   */
  start: async (workspaceId: string, id: string): Promise<RepairLog> => {
    return apiClient.post<RepairLog>(`/workspaces/${workspaceId}/repairs/${id}/start`);
  },

  /**
   * Complete a repair (in_progress -> completed)
   */
  complete: async (
    workspaceId: string,
    id: string,
    data?: RepairLogComplete
  ): Promise<RepairLog> => {
    return apiClient.post<RepairLog>(
      `/workspaces/${workspaceId}/repairs/${id}/complete`,
      data || {}
    );
  },

  /**
   * Delete a repair log
   */
  delete: async (workspaceId: string, id: string): Promise<void> => {
    await apiClient.delete(`/workspaces/${workspaceId}/repairs/${id}`);
  },
};
