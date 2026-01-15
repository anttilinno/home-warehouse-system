export interface Item {
  id: string;
  workspace_id: string;
  sku: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  brand?: string | null;
  model?: string | null;
  image_url?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  barcode?: string | null;
  is_insured?: boolean | null;
  is_archived?: boolean | null;
  lifetime_warranty?: boolean | null;
  warranty_details?: string | null;
  purchased_from?: string | null;
  min_stock_level: number;
  short_code?: string | null;
  obsidian_vault_path?: string | null;
  obsidian_note_path?: string | null;
  obsidian_uri?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemListResponse {
  items: Item[];
  total?: number;
  page?: number;
  total_pages?: number;
}

export interface ItemCreate {
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  brand?: string;
  model?: string;
  image_url?: string;
  serial_number?: string;
  manufacturer?: string;
  barcode?: string;
  is_insured?: boolean;
  lifetime_warranty?: boolean;
  warranty_details?: string;
  purchased_from?: string;
  min_stock_level?: number;
  short_code?: string;
  obsidian_vault_path?: string;
  obsidian_note_path?: string;
}

export interface ItemUpdate {
  name?: string;
  description?: string;
  category_id?: string;
  brand?: string;
  model?: string;
  image_url?: string;
  serial_number?: string;
  manufacturer?: string;
  barcode?: string;
  is_insured?: boolean;
  lifetime_warranty?: boolean;
  warranty_details?: string;
  purchased_from?: string;
  min_stock_level?: number;
  obsidian_vault_path?: string;
  obsidian_note_path?: string;
}

export interface ItemLabelsResponse {
  label_ids: string[];
}
