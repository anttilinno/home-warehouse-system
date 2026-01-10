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
    return apiClient.get<Category[]>("/categories", workspaceId);
  },

  create: async (workspaceId: string, data: CategoryCreate): Promise<Category> => {
    return apiClient.post<Category>("/categories", data, workspaceId);
  },

  update: async (workspaceId: string, id: string, data: CategoryUpdate): Promise<Category> => {
    return apiClient.patch<Category>(`/categories/${id}`, data, workspaceId);
  },

  delete: async (workspaceId: string, id: string): Promise<void> => {
    return apiClient.delete(`/categories/${id}`, workspaceId);
  },
};
