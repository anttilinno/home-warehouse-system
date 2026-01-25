import { apiClient } from "./client";
import type {
  RepairLog,
  RepairLogListResponse,
  RepairLogCreate,
  RepairLogUpdate,
  RepairLogComplete,
  RepairStatus,
  RepairPhoto,
  RepairPhotoType,
  RepairAttachment,
  AttachmentType,
  RepairCostSummary,
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

  /**
   * Upload a photo to a repair log
   */
  uploadPhoto: async (
    workspaceId: string,
    repairLogId: string,
    file: File,
    photoType: RepairPhotoType,
    caption?: string,
    onProgress?: (percentage: number) => void
  ): Promise<RepairPhoto> => {
    const formData = new FormData();
    formData.append("photo", file);
    formData.append("photo_type", photoType);
    if (caption) {
      formData.append("caption", caption);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentage = Math.round((e.loaded / e.total) * 100);
            onProgress(percentage);
          }
        });
      }

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.photo);
          } catch (error) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error occurred"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload cancelled"));
      });

      const token = apiClient.getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      xhr.open("POST", `${apiUrl}/workspaces/${workspaceId}/repairs/${repairLogId}/photos`);
      xhr.withCredentials = true;

      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.setRequestHeader("X-Workspace-ID", workspaceId);

      xhr.send(formData);
    });
  },

  /**
   * List photos for a repair log
   */
  listPhotos: async (workspaceId: string, repairLogId: string): Promise<RepairPhoto[]> => {
    const response = await apiClient.get<{ items: RepairPhoto[] }>(
      `/workspaces/${workspaceId}/repairs/${repairLogId}/photos/list`,
      workspaceId
    );
    return response.items || [];
  },

  /**
   * Delete a repair photo
   */
  deletePhoto: async (workspaceId: string, repairLogId: string, photoId: string): Promise<void> => {
    await apiClient.delete(
      `/workspaces/${workspaceId}/repairs/${repairLogId}/photos/${photoId}`,
      workspaceId
    );
  },

  /**
   * Update a repair photo caption
   */
  updatePhotoCaption: async (
    workspaceId: string,
    repairLogId: string,
    photoId: string,
    caption: string
  ): Promise<RepairPhoto> => {
    const response = await apiClient.patch<{ photo: RepairPhoto }>(
      `/workspaces/${workspaceId}/repairs/${repairLogId}/photos/${photoId}/caption`,
      { caption },
      workspaceId
    );
    return response.photo;
  },

  /**
   * Link an attachment to a repair log
   */
  linkAttachment: async (
    workspaceId: string,
    repairLogId: string,
    fileId: string,
    attachmentType: AttachmentType,
    title?: string
  ): Promise<RepairAttachment> => {
    const response = await apiClient.post<RepairAttachment>(
      `/workspaces/${workspaceId}/repairs/${repairLogId}/attachments`,
      { file_id: fileId, attachment_type: attachmentType, title },
      workspaceId
    );
    return response;
  },

  /**
   * List attachments for a repair log
   */
  listAttachments: async (workspaceId: string, repairLogId: string): Promise<RepairAttachment[]> => {
    const response = await apiClient.get<{ items: RepairAttachment[] }>(
      `/workspaces/${workspaceId}/repairs/${repairLogId}/attachments`,
      workspaceId
    );
    return response.items || [];
  },

  /**
   * Unlink an attachment from a repair log
   */
  unlinkAttachment: async (workspaceId: string, repairLogId: string, attachmentId: string): Promise<void> => {
    await apiClient.delete(
      `/workspaces/${workspaceId}/repairs/${repairLogId}/attachments/${attachmentId}`,
      workspaceId
    );
  },

  /**
   * Get total repair cost for an inventory item
   */
  getRepairCost: async (workspaceId: string, inventoryId: string): Promise<RepairCostSummary[]> => {
    const response = await apiClient.get<{ items: RepairCostSummary[] }>(
      `/workspaces/${workspaceId}/inventory/${inventoryId}/repair-cost`,
      workspaceId
    );
    return response.items || [];
  },

  /**
   * Set warranty claim flag on a repair log
   */
  setWarrantyClaim: async (workspaceId: string, repairLogId: string, isWarrantyClaim: boolean): Promise<RepairLog> => {
    return apiClient.patch<RepairLog>(
      `/workspaces/${workspaceId}/repairs/${repairLogId}`,
      { is_warranty_claim: isWarrantyClaim },
      workspaceId
    );
  },

  /**
   * Set reminder date on a repair log
   */
  setReminderDate: async (workspaceId: string, repairLogId: string, reminderDate: string | null): Promise<RepairLog> => {
    return apiClient.patch<RepairLog>(
      `/workspaces/${workspaceId}/repairs/${repairLogId}`,
      { reminder_date: reminderDate },
      workspaceId
    );
  },
};
