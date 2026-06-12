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
//
// `has_password` (added Phase 5 Plan 05) drives the Security password card
// (change-vs-set branch) AND the Connected Accounts unlink lockout guard. It is
// returned by GET /users/me (see 05-RESEARCH Interfaces / 05-UI-SPEC Identity).
export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  has_password: boolean;
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

// --- Auth account-management surfaces (Phase 5 Plan 05) ---

// GET /users/me/sessions → SessionResponse[]. device_info is a PARSED UA label
// (ParseDeviceInfo, e.g. "Chrome on Linux"); is_current is wired via Plan 01's
// CurrentSession middleware.
export interface SessionResponse {
  id: string;
  device_info: string;
  ip_address?: string;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

// GET /users/me/can-delete → blocking_workspaces lists the workspaces where the
// user is the sole owner (the server-authoritative delete block).
export interface BlockingWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface CanDeleteResponse {
  can_delete: boolean;
  blocking_workspaces: BlockingWorkspace[];
}

// GET /auth/oauth/accounts → { accounts: OAuthAccount[] }.
export interface OAuthAccount {
  provider: string;
  display_name?: string;
  email?: string;
}

export interface OAuthAccountsResponse {
  accounts: OAuthAccount[];
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
