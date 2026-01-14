import { apiClient } from "./client";

export interface OutOfStockItem {
  id: string;
  name: string;
  sku: string;
  min_stock_level: number;
  category_id: string | null;
  category_name: string | null;
}

export interface DashboardStats {
  total_items: number;
  total_inventory: number;
  total_locations: number;
  total_containers: number;
  active_loans: number;
  overdue_loans: number;
  low_stock_items: number;
  total_categories: number;
  total_borrowers: number;
}

export interface RecentActivity {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CategoryStats {
  id: string;
  name: string;
  item_count: number;
  inventory_count: number;
  total_value: number; // In cents
}

export interface LocationInventoryValue {
  id: string;
  name: string;
  item_count: number;
  total_quantity: number;
  total_value: number; // In cents
}

export interface ConditionBreakdown {
  condition: string;
  count: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
}

export interface TopBorrower {
  id: string;
  name: string;
  email?: string;
  total_loans: number;
  active_loans: number;
}

export interface MonthlyLoanActivity {
  month: string; // ISO date
  loans_created: number;
  loans_returned: number;
}

export interface LoanStats {
  total_loans: number;
  active_loans: number;
  returned_loans: number;
  overdue_loans: number;
}

export interface AnalyticsSummary {
  dashboard: DashboardStats;
  loan_stats: LoanStats;
  category_stats: CategoryStats[];
  location_values: LocationInventoryValue[];
  recent_activity: RecentActivity[];
  condition_breakdown: ConditionBreakdown[];
  status_breakdown: StatusBreakdown[];
  top_borrowers: TopBorrower[];
  monthly_loan_activity?: MonthlyLoanActivity[];
}

export const analyticsApi = {
  getOutOfStockItems: async (workspaceId: string): Promise<OutOfStockItem[]> => {
    return apiClient.get<OutOfStockItem[]>(`/workspaces/${workspaceId}/analytics/out-of-stock`);
  },

  getSummary: async (workspaceId: string): Promise<AnalyticsSummary> => {
    return apiClient.get<AnalyticsSummary>(`/workspaces/${workspaceId}/analytics/summary`);
  },

  getDashboardStats: async (workspaceId: string): Promise<DashboardStats> => {
    return apiClient.get<DashboardStats>(`/workspaces/${workspaceId}/analytics/dashboard`);
  },

  getRecentActivity: async (workspaceId: string, limit: number = 10): Promise<RecentActivity[]> => {
    return apiClient.get<RecentActivity[]>(`/workspaces/${workspaceId}/analytics/activity?limit=${limit}`);
  },

  getCategoryStats: async (workspaceId: string, limit: number = 10): Promise<CategoryStats[]> => {
    return apiClient.get<CategoryStats[]>(`/workspaces/${workspaceId}/analytics/categories?limit=${limit}`);
  },

  getLocationValues: async (workspaceId: string, limit: number = 10): Promise<LocationInventoryValue[]> => {
    return apiClient.get<LocationInventoryValue[]>(`/workspaces/${workspaceId}/analytics/locations?limit=${limit}`);
  },
};
