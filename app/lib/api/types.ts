// API Types - adapted from frontend/lib/api.ts

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  date_format: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
  is_personal?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
  workspaces: Workspace[];
}

export interface ApiError {
  detail: string;
  error_type?: string;
}

export interface Category {
  id: string;
  name: string;
  parent_category_id: string | null;
  description: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  zone: string | null;
  shelf: string | null;
  bin: string | null;
  description: string | null;
  parent_location_id: string | null;
  created_at: string;
}

export interface Container {
  id: string;
  name: string;
  location_id: string;
  location_name: string | null;
  description: string | null;
  capacity: string | null;
  short_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  category_id: string | null;
  category_name?: string | null;
  short_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemCreate {
  sku?: string | null;
  name: string;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  serial_number?: string | null;
  category_id?: string | null;
}

export interface Inventory {
  id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string | null;
  location_id: string;
  location_name?: string;
  container_id: string | null;
  container_name?: string | null;
  quantity: number;
  condition: string;
  status: string;
  purchase_price: number | null;
  expiration_date: string | null;
  warranty_expires: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryCreate {
  item_id: string;
  location_id: string;
  container_id?: string | null;
  quantity: number;
  condition?: string;
  status?: string;
  purchase_price?: number | null;
  expiration_date?: string | null;
  warranty_expires?: string | null;
}

export interface StockAdjustment {
  adjustment: number;
}

export interface BarcodeProduct {
  barcode: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  source: string;
  error?: string;
}
