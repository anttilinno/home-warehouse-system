import { apiClient } from "./client";

export type PendingChangeStatus = "pending" | "approved" | "rejected";
export type PendingChangeAction = "create" | "update" | "delete";
export type PendingChangeEntityType =
  | "item"
  | "location"
  | "container"
  | "category"
  | "borrower"
  | "loan"
  | "inventory";

export interface PendingChange {
  id: string;
  workspace_id: string;
  requester_id: string;
  requester_name: string;
  entity_type: PendingChangeEntityType;
  entity_id: string | null;
  action: PendingChangeAction;
  payload: Record<string, unknown>;
  status: PendingChangeStatus;
  reviewer_id: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingChangesListResponse {
  changes: PendingChange[];
  total: number;
}

export interface PendingChangesListParams {
  status?: PendingChangeStatus;
  entity_type?: PendingChangeEntityType;
  page?: number;
  limit?: number;
}

export interface ApproveChangeRequest {
  // No additional data needed for approval
}

export interface RejectChangeRequest {
  reason: string;
}

export const pendingChangesApi = {
  list: async (
    workspaceId: string,
    params?: PendingChangesListParams
  ): Promise<PendingChangesListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append("status", params.status);
    if (params?.entity_type) queryParams.append("entity_type", params.entity_type);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const query = queryParams.toString();
    const endpoint = `/workspaces/${workspaceId}/pending-changes${query ? `?${query}` : ""}`;

    return apiClient.get<PendingChangesListResponse>(endpoint);
  },

  get: async (workspaceId: string, changeId: string): Promise<PendingChange> => {
    return apiClient.get<PendingChange>(
      `/workspaces/${workspaceId}/pending-changes/${changeId}`
    );
  },

  approve: async (workspaceId: string, changeId: string): Promise<void> => {
    await apiClient.post(
      `/workspaces/${workspaceId}/pending-changes/${changeId}/approve`,
      {}
    );
  },

  reject: async (
    workspaceId: string,
    changeId: string,
    data: RejectChangeRequest
  ): Promise<void> => {
    await apiClient.post(
      `/workspaces/${workspaceId}/pending-changes/${changeId}/reject`,
      data
    );
  },

  getPendingCount: async (workspaceId: string): Promise<number> => {
    const response = await apiClient.get<PendingChangesListResponse>(
      `/workspaces/${workspaceId}/pending-changes?status=pending&limit=1`
    );
    return response.total;
  },

  getMyChanges: async (
    workspaceId: string,
    params?: PendingChangesListParams
  ): Promise<PendingChangesListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append("status", params.status);
    if (params?.entity_type) queryParams.append("entity_type", params.entity_type);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    // Add my_changes filter to only get current user's changes
    queryParams.append("requester", "me");

    const query = queryParams.toString();
    const endpoint = `/workspaces/${workspaceId}/pending-changes${query ? `?${query}` : ""}`;

    return apiClient.get<PendingChangesListResponse>(endpoint);
  },

  getMyPendingCount: async (workspaceId: string): Promise<number> => {
    const response = await apiClient.get<PendingChangesListResponse>(
      `/workspaces/${workspaceId}/pending-changes?status=pending&requester=me&limit=1`
    );
    return response.total;
  },
};
