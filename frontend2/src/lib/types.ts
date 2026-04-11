export interface User {
  id: string;
  email: string;
  full_name: string;
  has_password: boolean;
  is_active: boolean;
  date_format: string;
  time_format: string;
  thousand_separator: string;
  decimal_separator: string;
  language: string;
  theme: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenResponse {
  token: string;
  refresh_token: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  language?: string;
}

export interface ApiError {
  message?: string;
  detail?: string;
  code?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_personal: boolean;
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceListResponse {
  items: Workspace[];
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
  created_at: string;
}
