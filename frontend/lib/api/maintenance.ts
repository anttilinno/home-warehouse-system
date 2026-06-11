import { apiClient } from "./client";
import type {
  MaintenanceSchedule,
  MaintenanceScheduleListResponse,
  DueMaintenanceListResponse,
  MaintenanceScheduleCreate,
  MaintenanceScheduleUpdate,
  MaintenanceScheduleComplete,
} from "../types/maintenance";

export const maintenanceApi = {
  /**
   * List maintenance schedules in the workspace
   */
  list: async (
    workspaceId: string,
    params?: { page?: number; limit?: number }
  ): Promise<MaintenanceScheduleListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/maintenance${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<MaintenanceScheduleListResponse>(url);
  },

  /**
   * List schedules due within N days (overdue always included)
   */
  listDue: async (workspaceId: string, days = 7): Promise<DueMaintenanceListResponse> => {
    return apiClient.get<DueMaintenanceListResponse>(
      `/workspaces/${workspaceId}/maintenance/due?days=${days}`
    );
  },

  /**
   * List schedules for an inventory entry
   */
  listByInventory: async (
    workspaceId: string,
    inventoryId: string
  ): Promise<MaintenanceSchedule[]> => {
    const response = await apiClient.get<MaintenanceScheduleListResponse>(
      `/workspaces/${workspaceId}/inventory/${inventoryId}/maintenance`
    );
    return response.items;
  },

  /**
   * Get a schedule by ID
   */
  get: async (workspaceId: string, id: string): Promise<MaintenanceSchedule> => {
    return apiClient.get<MaintenanceSchedule>(`/workspaces/${workspaceId}/maintenance/${id}`);
  },

  /**
   * Create a schedule
   */
  create: async (
    workspaceId: string,
    data: MaintenanceScheduleCreate
  ): Promise<MaintenanceSchedule> => {
    return apiClient.post<MaintenanceSchedule>(`/workspaces/${workspaceId}/maintenance`, data);
  },

  /**
   * Update a schedule
   */
  update: async (
    workspaceId: string,
    id: string,
    data: MaintenanceScheduleUpdate
  ): Promise<MaintenanceSchedule> => {
    return apiClient.patch<MaintenanceSchedule>(
      `/workspaces/${workspaceId}/maintenance/${id}`,
      data
    );
  },

  /**
   * Complete a schedule: writes a repair log and advances next_due
   */
  complete: async (
    workspaceId: string,
    id: string,
    data: MaintenanceScheduleComplete = {}
  ): Promise<MaintenanceSchedule> => {
    return apiClient.post<MaintenanceSchedule>(
      `/workspaces/${workspaceId}/maintenance/${id}/complete`,
      data
    );
  },

  /**
   * Delete a schedule
   */
  delete: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.delete(`/workspaces/${workspaceId}/maintenance/${id}`);
  },
};
