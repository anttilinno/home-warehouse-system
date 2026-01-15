export type InventoryCondition =
  | "NEW"
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "POOR"
  | "DAMAGED"
  | "FOR_REPAIR";

export type InventoryStatus =
  | "AVAILABLE"
  | "IN_USE"
  | "RESERVED"
  | "ON_LOAN"
  | "IN_TRANSIT"
  | "DISPOSED"
  | "MISSING";

export interface Inventory {
  id: string;
  workspace_id: string;
  item_id: string;
  location_id: string;
  container_id?: string | null;
  quantity: number;
  condition: InventoryCondition;
  status: InventoryStatus;
  date_acquired?: string | null;
  purchase_price?: number | null; // in cents
  currency_code?: string | null;
  warranty_expires?: string | null;
  expiration_date?: string | null;
  notes?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryListResponse {
  items: Inventory[];
  total: number;
  page: number;
  total_pages: number;
}

export interface InventoryCreate {
  item_id: string;
  location_id: string;
  container_id?: string;
  quantity: number;
  condition: InventoryCondition;
  status: InventoryStatus;
  date_acquired?: string;
  purchase_price?: number; // in cents
  currency_code?: string;
  warranty_expires?: string;
  expiration_date?: string;
  notes?: string;
}

export interface InventoryUpdate {
  location_id: string;
  container_id?: string;
  quantity: number;
  condition: InventoryCondition;
  date_acquired?: string;
  purchase_price?: number; // in cents
  currency_code?: string;
  warranty_expires?: string;
  expiration_date?: string;
  notes?: string;
}

export interface InventoryStatusUpdate {
  status: InventoryStatus;
}

export interface InventoryQuantityUpdate {
  quantity: number;
}

export interface InventoryMove {
  location_id: string;
  container_id?: string;
}

export interface TotalQuantityResponse {
  item_id: string;
  total_quantity: number;
}
