import { apiClient } from "./client";

export interface Category {
  id: string;
  name: string;
  parent_category_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  parent_category_id?: string | null;
  description?: string | null;
}

export interface CategoryUpdate {
  name?: string;
  parent_category_id?: string | null;
  description?: string | null;
}

export const categoriesApi = {
  list: async (workspaceId: string): Promise<Category[]> => {
    const response = await apiClient.get<{ items: Category[] }>(`/workspaces/${workspaceId}/categories`);
    return response.items;
  },

  create: async (workspaceId: string, data: CategoryCreate): Promise<Category> => {
    return apiClient.post<Category>(`/workspaces/${workspaceId}/categories`, data);
  },

  update: async (workspaceId: string, id: string, data: CategoryUpdate): Promise<Category> => {
    return apiClient.patch<Category>(`/workspaces/${workspaceId}/categories/${id}`, data);
  },

  delete: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.delete(`/workspaces/${workspaceId}/categories/${id}`);
  },
};
