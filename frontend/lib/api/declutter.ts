import { apiClient } from "./client";
import type {
  DeclutterItem,
  DeclutterListResponse,
  DeclutterCounts,
  DeclutterListParams,
} from "../types/declutter";

export const declutterApi = {
  /**
   * List unused inventory items with declutter scores
   */
  listUnused: async (
    workspaceId: string,
    params?: DeclutterListParams
  ): Promise<DeclutterListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.threshold_days) {
      queryParams.append("threshold_days", params.threshold_days.toString());
    }
    if (params?.group_by) {
      queryParams.append("group_by", params.group_by);
    }
    if (params?.page) {
      queryParams.append("page", params.page.toString());
    }
    if (params?.limit) {
      queryParams.append("limit", params.limit.toString());
    }

    const url = `/workspaces/${workspaceId}/declutter${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;
    return apiClient.get<DeclutterListResponse>(url);
  },

  /**
   * Get summary counts for different thresholds
   */
  getCounts: async (workspaceId: string): Promise<DeclutterCounts> => {
    return apiClient.get<DeclutterCounts>(
      `/workspaces/${workspaceId}/declutter/counts`
    );
  },

  /**
   * Mark an inventory item as recently used
   */
  markAsUsed: async (
    workspaceId: string,
    inventoryId: string
  ): Promise<{ success: boolean }> => {
    return apiClient.post<{ success: boolean }>(
      `/workspaces/${workspaceId}/inventory/${inventoryId}/mark-used`
    );
  },
};
