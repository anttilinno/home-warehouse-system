/**
 * Declutter Assistant Types
 * Types for identifying and managing unused inventory items
 */

export interface DeclutterItem {
  id: string;
  workspace_id: string;
  item_id: string;
  location_id: string;
  container_id?: string;
  quantity: number;
  condition?: string;
  status?: string;
  purchase_price?: number; // cents
  currency_code?: string;
  last_used_at?: string;
  item_name: string;
  item_sku?: string;
  location_name: string;
  category_name?: string;
  category_id?: string;
  days_unused: number;
  score: number; // 0-150, higher = higher priority to declutter
}

export interface DeclutterListResponse {
  items: DeclutterItem[];
  total: number;
  page: number;
  total_pages: number;
}

export interface DeclutterCounts {
  unused_90: number;
  unused_180: number;
  unused_365: number;
  value_90: number; // cents
  value_180: number;
  value_365: number;
}

export type DeclutterGroupBy = "category" | "location" | "";

export interface DeclutterListParams {
  threshold_days?: number;
  group_by?: DeclutterGroupBy;
  page?: number;
  limit?: number;
}
