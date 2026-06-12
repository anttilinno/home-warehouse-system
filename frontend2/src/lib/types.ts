// Phase 1 (v3.0) trim: only ApiError ports forward. The auth/analytics
// shapes below landed early (retro-os sample screens, 2026-06-11) — copied
// from legacy frontend/lib/api/auth.ts + analytics.ts (same backend).

export interface ApiError {
  message?: string;
  detail?: string;
  code?: string;
}

// Subset of the backend user shape — only what the sample screens render.
// Phase 5 (Auth) re-introduces the full v3.0 User.
export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

export interface AuthTokenResponse {
  token: string;
  refresh_token: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
  is_personal: boolean;
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
