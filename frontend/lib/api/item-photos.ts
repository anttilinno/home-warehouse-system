import { apiClient } from "./client";
import type {
  ItemPhoto,
  PhotoListResponse,
  PhotoResponse,
  UploadPhotoResponse,
  UpdateCaptionRequest,
  ReorderPhotosRequest,
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

      xhr.open("POST", `${apiUrl}/api/workspaces/${workspaceId}/items/${itemId}/photos`);

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
    const response = await apiClient.get<PhotoListResponse>(
      `/api/workspaces/${workspaceId}/items/${itemId}/photos`,
      workspaceId
    );
    return response.photos;
  },

  /**
   * Get a single photo by ID
   */
  getPhoto: async (workspaceId: string, photoId: string): Promise<ItemPhoto> => {
    const response = await apiClient.get<PhotoResponse>(
      `/api/workspaces/${workspaceId}/item-photos/${photoId}`,
      workspaceId
    );
    return response.photo;
  },

  /**
   * Set a photo as the primary photo for its item
   */
  setPrimaryPhoto: async (workspaceId: string, photoId: string): Promise<ItemPhoto> => {
    const response = await apiClient.post<PhotoResponse>(
      `/api/workspaces/${workspaceId}/item-photos/${photoId}/set-primary`,
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
      `/api/workspaces/${workspaceId}/item-photos/${photoId}`,
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
    const response = await apiClient.post<PhotoListResponse>(
      `/api/workspaces/${workspaceId}/items/${itemId}/photos/reorder`,
      body,
      workspaceId
    );
    return response.photos;
  },

  /**
   * Delete a photo
   */
  deletePhoto: async (workspaceId: string, photoId: string): Promise<void> => {
    await apiClient.delete(
      `/api/workspaces/${workspaceId}/item-photos/${photoId}`,
      workspaceId
    );
  },
};
