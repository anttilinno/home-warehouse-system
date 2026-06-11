import { apiClient } from "./client";
import type {
  WishlistItem,
  WishlistListResponse,
  WishlistItemCreate,
  WishlistItemUpdate,
  WishlistStatus,
} from "../types/wishlist";

export const wishlistApi = {
  /**
   * List wishlist items in the workspace (sorted by priority, 1 = highest
   * first), optionally filtered by lifecycle status.
   */
  list: async (
    workspaceId: string,
    params?: { status?: WishlistStatus; page?: number; limit?: number }
  ): Promise<WishlistListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append("status", params.status);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `/workspaces/${workspaceId}/wishlist${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiClient.get<WishlistListResponse>(url);
  },

  /**
   * Get a wishlist item by ID
   */
  get: async (workspaceId: string, id: string): Promise<WishlistItem> => {
    return apiClient.get<WishlistItem>(`/workspaces/${workspaceId}/wishlist/${id}`);
  },

  /**
   * Create a wishlist item
   */
  create: async (workspaceId: string, data: WishlistItemCreate): Promise<WishlistItem> => {
    return apiClient.post<WishlistItem>(`/workspaces/${workspaceId}/wishlist`, data);
  },

  /**
   * Update a wishlist item. A status field performs a lifecycle transition
   * (wanted ⇄ ordered, * → acquired); status "acquired" together with
   * acquired_item_id is the "mark acquired / close the row" path.
   */
  update: async (
    workspaceId: string,
    id: string,
    data: WishlistItemUpdate
  ): Promise<WishlistItem> => {
    return apiClient.patch<WishlistItem>(`/workspaces/${workspaceId}/wishlist/${id}`, data);
  },

  /**
   * Delete a wishlist item
   */
  delete: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.delete(`/workspaces/${workspaceId}/wishlist/${id}`);
  },
};
