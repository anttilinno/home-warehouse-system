export type WishlistStatus = "wanted" | "ordered" | "acquired";

export interface WishlistItem {
  id: string;
  workspace_id: string;
  name: string;
  notes?: string | null;
  url?: string | null;
  price_estimate?: number | null; // cents
  currency_code?: string | null;
  priority: number; // 1 (highest) .. 5 (lowest)
  desired_category_id?: string | null;
  status: WishlistStatus;
  acquired_item_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WishlistListResponse {
  items: WishlistItem[];
  total: number;
}

export interface WishlistItemCreate {
  name: string;
  notes?: string;
  url?: string;
  price_estimate?: number; // cents
  currency_code?: string;
  priority?: number;
  desired_category_id?: string;
}

export interface WishlistItemUpdate {
  name?: string;
  notes?: string;
  url?: string;
  price_estimate?: number; // cents
  currency_code?: string;
  priority?: number;
  desired_category_id?: string;
  /** Lifecycle transition; "acquired" closes the row */
  status?: WishlistStatus;
  /** Item created from this wish; links back and closes the row */
  acquired_item_id?: string;
}
