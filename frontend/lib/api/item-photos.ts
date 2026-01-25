import { apiClient } from "./client";
import type {
  ItemPhoto,
  PhotoListResponse,
  PhotoResponse,
  UploadPhotoResponse,
  UpdateCaptionRequest,
  ReorderPhotosRequest,
  CaptionUpdate,
  DuplicateCheckResponse,
} from "../types/item-photo";

/**
 * API client for item photo management
 */
export const itemPhotosApi = {
  /**
   * Upload a new photo for an item
   */
  uploadItemPhoto: async (
    workspaceId: string,
    itemId: string,
    file: File,
    caption?: string,
    onProgress?: (percentage: number) => void
  ): Promise<ItemPhoto> => {
    const formData = new FormData();
    formData.append("photo", file);
    if (caption) {
      formData.append("caption", caption);
    }

    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
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
            const response: UploadPhotoResponse = JSON.parse(xhr.responseText);
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

      // Get auth token and build headers
      const token = apiClient.getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      xhr.open("POST", `${apiUrl}/workspaces/${workspaceId}/items/${itemId}/photos`);
      xhr.withCredentials = true;

      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.setRequestHeader("X-Workspace-ID", workspaceId);

      xhr.send(formData);
    });
  },

  /**
   * Get all photos for an item
   */
  getItemPhotos: async (workspaceId: string, itemId: string): Promise<ItemPhoto[]> => {
    const response = await apiClient.get<{ items: ItemPhoto[] }>(
      `/workspaces/${workspaceId}/items/${itemId}/photos/list`,
      workspaceId
    );
    return response.items || [];
  },

  /**
   * Get a single photo by ID
   */
  getPhoto: async (workspaceId: string, photoId: string): Promise<ItemPhoto> => {
    const response = await apiClient.get<PhotoResponse>(
      `/workspaces/${workspaceId}/photos/${photoId}`,
      workspaceId
    );
    return response.photo;
  },

  /**
   * Set a photo as the primary photo for its item
   */
  setPrimaryPhoto: async (workspaceId: string, photoId: string): Promise<ItemPhoto> => {
    const response = await apiClient.post<PhotoResponse>(
      `/workspaces/${workspaceId}/photos/${photoId}/set-primary`,
      undefined,
      workspaceId
    );
    return response.photo;
  },

  /**
   * Update a photo's caption
   */
  updatePhotoCaption: async (
    workspaceId: string,
    photoId: string,
    caption: string
  ): Promise<ItemPhoto> => {
    const body: UpdateCaptionRequest = { caption };
    const response = await apiClient.patch<PhotoResponse>(
      `/workspaces/${workspaceId}/photos/${photoId}`,
      body,
      workspaceId
    );
    return response.photo;
  },

  /**
   * Reorder photos for an item
   */
  reorderPhotos: async (
    workspaceId: string,
    itemId: string,
    photoIds: string[]
  ): Promise<ItemPhoto[]> => {
    const body: ReorderPhotosRequest = { photo_ids: photoIds };
    const response = await apiClient.post<{ items: ItemPhoto[] }>(
      `/workspaces/${workspaceId}/items/${itemId}/photos/order`,
      body,
      workspaceId
    );
    return response.items || [];
  },

  /**
   * Delete a photo
   */
  deletePhoto: async (workspaceId: string, photoId: string): Promise<void> => {
    await apiClient.delete(
      `/workspaces/${workspaceId}/photos/${photoId}`,
      workspaceId
    );
  },

  /**
   * Bulk delete multiple photos
   */
  bulkDelete: async (
    workspaceId: string,
    itemId: string,
    photoIds: string[]
  ): Promise<void> => {
    await apiClient.post(
      `/workspaces/${workspaceId}/items/${itemId}/photos/bulk-delete`,
      { photo_ids: photoIds },
      workspaceId
    );
  },

  /**
   * Bulk update captions for multiple photos
   */
  bulkUpdateCaptions: async (
    workspaceId: string,
    itemId: string,
    updates: CaptionUpdate[]
  ): Promise<void> => {
    await apiClient.post(
      `/workspaces/${workspaceId}/items/${itemId}/photos/bulk-caption`,
      { updates },
      workspaceId
    );
  },

  /**
   * Download photos as zip file
   * Uses fetch+blob to include auth headers (window.open cannot send headers)
   * @param photoIds - Optional array of photo IDs. If empty, downloads all photos.
   */
  downloadAsZip: async (
    workspaceId: string,
    itemId: string,
    photoIds?: string[]
  ): Promise<void> => {
    const token = apiClient.getToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let url = `${apiUrl}/workspaces/${workspaceId}/items/${itemId}/photos/download`;
    if (photoIds && photoIds.length > 0) {
      url += `?ids=${photoIds.join(",")}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-Workspace-ID": workspaceId,
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    // Create blob and trigger download
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `photos-${itemId.slice(0, 8)}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Check for duplicate photos before upload
   */
  checkDuplicates: async (
    workspaceId: string,
    itemId: string,
    file: File
  ): Promise<DuplicateCheckResponse> => {
    const formData = new FormData();
    formData.append("photo", file);

    const token = apiClient.getToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const response = await fetch(
      `${apiUrl}/workspaces/${workspaceId}/items/${itemId}/photos/check-duplicate`,
      {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-Workspace-ID": workspaceId,
        },
        credentials: "include",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },
};
