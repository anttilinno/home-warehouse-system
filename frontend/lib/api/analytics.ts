import { apiClient } from "./client";

export interface OutOfStockItem {
  id: string;
  name: string;
  sku: string;
  min_stock_level: number;
  category_id: string | null;
  category_name: string | null;
}

export const analyticsApi = {
  getOutOfStockItems: async (workspaceId: string): Promise<OutOfStockItem[]> => {
    return apiClient.get<OutOfStockItem[]>("/analytics/out-of-stock", workspaceId);
  },
};
