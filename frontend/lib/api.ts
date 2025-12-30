const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const IS_DEV = process.env.NODE_ENV === 'development';

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
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  full_name?: string | null;
  email?: string;
  date_format?: string;
  language?: string;
  theme?: string;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
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
  code?: string;  // Error code from backend (e.g., "WORKSPACE_PROTECTED")
  error_type?: string;
  traceback?: string;
  exception_type?: string;
}

// Custom error class that includes the backend error code
export class ApiErrorWithCode extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
    this.name = 'ApiErrorWithCode';
  }
}

// Global error handler for showing 500 errors in development
let globalErrorHandler: ((error: ApiError) => void) | null = null;

export function setApiErrorHandler(handler: (error: ApiError) => void) {
  console.log('[API] Error handler registered');
  globalErrorHandler = handler;
}

function showServerError(error: ApiError) {
  console.log('[API] showServerError called:', { IS_DEV, hasHandler: !!globalErrorHandler, error });
  if (IS_DEV && globalErrorHandler) {
    globalErrorHandler(error);
  } else if (IS_DEV) {
    console.warn('[API] Error handler not registered yet, error:', error);
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = tokenStorage.getToken();
    const workspaceId = workspaceStorage.getWorkspaceId();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (workspaceId) {
      headers['X-Workspace-ID'] = workspaceId;
    }

    return headers;
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));

      // Handle authentication errors - but only redirect if we had a token (session expired)
      // For login attempts (no token), pass through the actual error message
      if (response.status === 401) {
        const hadToken = !!tokenStorage.getToken();
        tokenStorage.removeToken();
        if (hadToken && typeof window !== 'undefined') {
          window.location.href = '/en/login';
          throw new ApiErrorWithCode('Authentication required');
        }
        // No token = login attempt failed, pass through actual error
        throw new ApiErrorWithCode(errorData.detail || 'Invalid credentials', errorData.code);
      }

      // Show error modal for 500 errors in development
      if (response.status >= 500) {
        showServerError(errorData);
      }

      throw new ApiErrorWithCode(errorData.detail || `HTTP ${response.status}`, errorData.code);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401) {
        // Clear invalid token and redirect to login
        tokenStorage.removeToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/en/login';
        }
        throw new ApiErrorWithCode('Authentication required');
      }

      const errorData: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));

      // Show error modal for 500 errors in development
      if (response.status >= 500) {
        showServerError(errorData);
      }

      throw new ApiErrorWithCode(errorData.detail || `HTTP ${response.status}`, errorData.code);
    }

    return response.json();
  }

  async patch<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 401) {
        tokenStorage.removeToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/en/login';
        }
        throw new ApiErrorWithCode('Authentication required');
      }

      const errorData: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));

      if (response.status >= 500) {
        showServerError(errorData);
      }

      throw new ApiErrorWithCode(errorData.detail || `HTTP ${response.status}`, errorData.code);
    }

    return response.json();
  }

  async delete(endpoint: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        tokenStorage.removeToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/en/login';
        }
        throw new ApiErrorWithCode('Authentication required');
      }

      const errorData: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));

      if (response.status >= 500) {
        showServerError(errorData);
      }

      throw new ApiErrorWithCode(errorData.detail || `HTTP ${response.status}`, errorData.code);
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// Auth API functions
export const authApi = {
  login: async (email: string, password: string): Promise<TokenResponse> => {
    return apiClient.post<TokenResponse>('/auth/login', {
      email,
      password,
    });
  },

  register: async (userData: {
    email: string;
    full_name: string;
    password: string;
    language?: string;
  }) => {
    return apiClient.post('/auth/register', userData);
  },

  getProfile: async (): Promise<User> => {
    return apiClient.get<User>('/auth/me');
  },

  getWorkspaces: async (): Promise<Workspace[]> => {
    return apiClient.get<Workspace[]>('/auth/me/workspaces');
  },

  updateProfile: async (data: ProfileUpdate): Promise<User> => {
    return apiClient.patch<User>('/auth/me', data);
  },

  changePassword: async (data: PasswordChange): Promise<User> => {
    return apiClient.post<User>('/auth/me/password', data);
  },

  requestPasswordReset: async (email: string): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/password-reset/request', { email });
  },

  confirmPasswordReset: async (token: string, newPassword: string): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/password-reset/confirm', {
      token,
      new_password: newPassword,
    });
  },
};

// OAuth types and API
export interface OAuthAccount {
  id: string;
  provider: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface OAuthProvider {
  provider: string;
  enabled: boolean;
}

export const oauthApi = {
  getProviders: async (): Promise<OAuthProvider[]> => {
    return apiClient.get<OAuthProvider[]>('/auth/oauth/providers');
  },

  getLoginUrl: (provider: string, nextUrl?: string): string => {
    const base = `${API_BASE_URL}/auth/oauth/${provider}/login`;
    if (nextUrl) {
      return `${base}?next=${encodeURIComponent(nextUrl)}`;
    }
    return base;
  },

  getLinkedAccounts: async (): Promise<OAuthAccount[]> => {
    return apiClient.get<OAuthAccount[]>('/auth/me/oauth-accounts');
  },

  unlinkAccount: async (accountId: string): Promise<void> => {
    return apiClient.delete(`/auth/me/oauth-accounts/${accountId}`);
  },
};

// Workspace management interfaces and API
export interface WorkspaceCreate {
  name: string;
  description?: string | null;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface WorkspaceMemberInvite {
  email: string;
  role?: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  full_name: string;
}

export const workspacesApi = {
  create: async (data: WorkspaceCreate): Promise<Workspace> => {
    return apiClient.post<Workspace>('/auth/workspaces', data);
  },

  delete: async (workspaceId: string): Promise<void> => {
    return apiClient.delete(`/auth/workspaces/${workspaceId}`);
  },

  getMembers: async (workspaceId: string): Promise<WorkspaceMember[]> => {
    return apiClient.get<WorkspaceMember[]>(`/auth/workspaces/${workspaceId}/members`);
  },

  inviteMember: async (workspaceId: string, data: WorkspaceMemberInvite): Promise<WorkspaceMember> => {
    return apiClient.post<WorkspaceMember>(`/auth/workspaces/${workspaceId}/members`, data);
  },

  removeMember: async (workspaceId: string, memberId: string): Promise<void> => {
    return apiClient.delete(`/auth/workspaces/${workspaceId}/members/${memberId}`);
  },

  searchUsers: async (workspaceId: string, query?: string): Promise<UserSearchResult[]> => {
    const params = new URLSearchParams();
    params.append('workspace_id', workspaceId);
    if (query) {
      params.append('q', query);
    }
    return apiClient.get<UserSearchResult[]>(`/auth/users/search?${params.toString()}`);
  },
};

// Dashboard API functions
export interface DashboardStats {
  total_items: number;
  total_locations: number;
  active_loans: number;
  total_categories: number;
}

export interface DashboardExtendedStats {
  total_items: number;
  total_locations: number;
  active_loans: number;
  total_categories: number;
  total_inventory_value: number;
  currency_code: string;
  out_of_stock_count: number;
  low_stock_count: number;
  expiring_soon_count: number;
  warranty_expiring_count: number;
  overdue_loans_count: number;
  due_soon_loans_count: number;
}

export interface InventorySummary {
  id: string;
  item_name: string;
  item_sku: string;
  location_name: string;
  quantity: number;
  updated_at: string;
}

export interface InventoryAlertItem {
  id: string;
  item_name: string;
  item_sku: string;
  location_name: string;
  quantity: number;
  expiration_date?: string | null;
  warranty_expires?: string | null;
}

export interface OverdueLoan {
  id: string;
  borrower_name: string;
  item_name: string;
  quantity: number;
  due_date: string;
  days_overdue: number;
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    return apiClient.get<DashboardStats>('/dashboard/stats');
  },

  getExtendedStats: async (): Promise<DashboardExtendedStats> => {
    return apiClient.get<DashboardExtendedStats>('/dashboard/stats/extended');
  },

  getRecentlyModified: async (limit: number = 10): Promise<InventorySummary[]> => {
    return apiClient.get<InventorySummary[]>(`/dashboard/recent?limit=${limit}`);
  },

  getOutOfStock: async (limit: number = 10): Promise<InventorySummary[]> => {
    return apiClient.get<InventorySummary[]>(`/dashboard/alerts/out-of-stock?limit=${limit}`);
  },

  getLowStock: async (limit: number = 10): Promise<InventorySummary[]> => {
    return apiClient.get<InventorySummary[]>(`/dashboard/alerts/low-stock?limit=${limit}`);
  },

  getExpiringSoon: async (limit: number = 10): Promise<InventoryAlertItem[]> => {
    return apiClient.get<InventoryAlertItem[]>(`/dashboard/alerts/expiring?limit=${limit}`);
  },

  getWarrantyExpiring: async (limit: number = 10): Promise<InventoryAlertItem[]> => {
    return apiClient.get<InventoryAlertItem[]>(`/dashboard/alerts/warranty-expiring?limit=${limit}`);
  },

  getOverdueLoans: async (limit: number = 10): Promise<OverdueLoan[]> => {
    return apiClient.get<OverdueLoan[]>(`/dashboard/alerts/overdue-loans?limit=${limit}`);
  },
};

// Category interfaces and API
export interface Category {
  id: string;
  name: string;
  parent_category_id: string | null;
  description: string | null;
  created_at: string;
}

export interface CategoryCreate {
  name: string;
  parent_category_id?: string | null;
  description?: string | null;
}

export interface CategoryUpdate {
  name?: string | null;
  parent_category_id?: string | null;
  description?: string | null;
}

export const categoriesApi = {
  list: async (): Promise<Category[]> => {
    return apiClient.get<Category[]>('/categories');
  },

  create: async (data: CategoryCreate): Promise<Category> => {
    return apiClient.post<Category>('/categories', data);
  },

  update: async (id: string, data: CategoryUpdate): Promise<Category> => {
    return apiClient.patch<Category>(`/categories/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/categories/${id}`);
  },
};

// Item interfaces and API
export interface Item {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  brand: string | null;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  image_url: string | null;
  is_insured: boolean;
  is_archived: boolean;
  lifetime_warranty: boolean;
  warranty_details: string | null;
  short_code: string | null;
  created_at: string;
  updated_at: string;
  obsidian_vault_path: string | null;
  obsidian_note_path: string | null;
  obsidian_url: string | null;
}

export interface ItemCreate {
  sku: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  brand?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  serial_number?: string | null;
  image_url?: string | null;
  is_insured?: boolean;
  lifetime_warranty?: boolean;
  warranty_details?: string | null;
  obsidian_vault_path?: string | null;
  obsidian_note_path?: string | null;
}

export interface ItemUpdate {
  name?: string | null;
  description?: string | null;
  category_id?: string | null;
  brand?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  serial_number?: string | null;
  image_url?: string | null;
  is_insured?: boolean;
  is_archived?: boolean;
  lifetime_warranty?: boolean;
  warranty_details?: string | null;
  obsidian_vault_path?: string | null;
  obsidian_note_path?: string | null;
}

export const itemsApi = {
  list: async (): Promise<Item[]> => {
    return apiClient.get<Item[]>('/items');
  },

  get: async (id: string): Promise<Item> => {
    return apiClient.get<Item>(`/items/${id}`);
  },

  create: async (data: ItemCreate): Promise<Item> => {
    return apiClient.post<Item>('/items', data);
  },

  update: async (id: string, data: ItemUpdate): Promise<Item> => {
    return apiClient.patch<Item>(`/items/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/items/${id}`);
  },
};

// Location interfaces and API
export interface Location {
  id: string;
  name: string;
  zone: string | null;
  shelf: string | null;
  bin: string | null;
  description: string | null;
  created_at: string;
  parent_location_id?: string | null;
  inventory_count?: number;
}

export interface LocationCreate {
  name: string;
  zone?: string | null;
  shelf?: string | null;
  bin?: string | null;
  description?: string | null;
  parent_location_id?: string | null;
}

export interface LocationUpdate {
  name?: string | null;
  zone?: string | null;
  shelf?: string | null;
  bin?: string | null;
  description?: string | null;
  parent_location_id?: string | null;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export const locationsApi = {
  list: async (): Promise<Location[]> => {
    return apiClient.get<Location[]>('/locations');
  },

  get: async (id: string): Promise<Location> => {
    return apiClient.get<Location>(`/locations/${id}`);
  },

  create: async (data: LocationCreate): Promise<Location> => {
    return apiClient.post<Location>('/locations', data);
  },

  update: async (id: string, data: LocationUpdate): Promise<Location> => {
    return apiClient.patch<Location>(`/locations/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/locations/${id}`);
  },

  getBreadcrumb: async (id: string): Promise<BreadcrumbItem[]> => {
    return apiClient.get<BreadcrumbItem[]>(`/locations/${id}/breadcrumb`);
  },
};

// Utility function to format breadcrumb path
export function formatLocationBreadcrumb(breadcrumb: BreadcrumbItem[]): string {
  return breadcrumb.map(item => item.name).join(' → ');
}

// Container interfaces and API
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

export interface ContainerCreate {
  name: string;
  location_id: string;
  description?: string | null;
  capacity?: string | null;
  short_code?: string | null;
}

export interface ContainerUpdate {
  name?: string | null;
  location_id?: string | null;
  description?: string | null;
  capacity?: string | null;
  short_code?: string | null;
}

export const containersApi = {
  list: async (): Promise<Container[]> => {
    return apiClient.get<Container[]>('/containers');
  },

  get: async (id: string): Promise<Container> => {
    return apiClient.get<Container>(`/containers/${id}`);
  },

  create: async (data: ContainerCreate): Promise<Container> => {
    return apiClient.post<Container>('/containers', data);
  },

  update: async (id: string, data: ContainerUpdate): Promise<Container> => {
    return apiClient.patch<Container>(`/containers/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/containers/${id}`);
  },
};

// Inventory interfaces and API
export interface Inventory {
  id: string;
  item_id: string;
  location_id: string;
  quantity: number;
  expiration_date: string | null;
  warranty_expires: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryCreate {
  item_id: string;
  location_id: string;
  quantity: number;
  expiration_date?: string | null;
  warranty_expires?: string | null;
}

export interface InventoryUpdate {
  quantity?: number;
  expiration_date?: string | null;
  warranty_expires?: string | null;
}

export interface StockAdjustment {
  quantity_change: number;
}

export const inventoryApi = {
  list: async (): Promise<Inventory[]> => {
    return apiClient.get<Inventory[]>('/inventory');
  },

  get: async (id: string): Promise<Inventory> => {
    return apiClient.get<Inventory>(`/inventory/${id}`);
  },

  create: async (data: InventoryCreate): Promise<Inventory> => {
    return apiClient.post<Inventory>('/inventory', data);
  },

  update: async (id: string, data: InventoryUpdate): Promise<Inventory> => {
    return apiClient.patch<Inventory>(`/inventory/${id}`, data);
  },

  adjustStock: async (id: string, data: StockAdjustment): Promise<Inventory> => {
    return apiClient.patch<Inventory>(`/inventory/${id}/adjust`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/inventory/${id}`);
  },
};

// Borrower interfaces and API
export interface Borrower {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface BorrowerCreate {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface BorrowerUpdate {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export const borrowersApi = {
  list: async (): Promise<Borrower[]> => {
    return apiClient.get<Borrower[]>('/borrowers');
  },

  get: async (id: string): Promise<Borrower> => {
    return apiClient.get<Borrower>(`/borrowers/${id}`);
  },

  create: async (data: BorrowerCreate): Promise<Borrower> => {
    return apiClient.post<Borrower>('/borrowers', data);
  },

  update: async (id: string, data: BorrowerUpdate): Promise<Borrower> => {
    return apiClient.patch<Borrower>(`/borrowers/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/borrowers/${id}`);
  },
};

// Loan interfaces and API
export interface Loan {
  id: string;
  inventory_id: string;
  borrower_id: string;
  quantity: number;
  loaned_at: string;
  due_date: string | null;
  returned_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanCreate {
  inventory_id: string;
  borrower_id: string;
  quantity?: number;
  due_date?: string | null;
  notes?: string | null;
}

export interface LoanCreateResponse {
  job_id: string;
  status: string;
}

export interface LoanReturn {
  notes?: string | null;
}

export const loansApi = {
  list: async (): Promise<Loan[]> => {
    return apiClient.get<Loan[]>('/loans');
  },

  listActive: async (): Promise<Loan[]> => {
    return apiClient.get<Loan[]>('/loans/active');
  },

  get: async (id: string): Promise<Loan> => {
    return apiClient.get<Loan>(`/loans/${id}`);
  },

  create: async (data: LoanCreate): Promise<LoanCreateResponse> => {
    return apiClient.post<LoanCreateResponse>('/loans', data);
  },

  getJobStatus: async (jobId: string): Promise<{ status: string; loan_id?: string; error?: string }> => {
    return apiClient.get<{ status: string; loan_id?: string; error?: string }>(`/loans/jobs/${jobId}`);
  },

  return: async (id: string, data: LoanReturn = {}): Promise<Loan> => {
    return apiClient.patch<Loan>(`/loans/${id}/return`, data);
  },
};

// Analytics interfaces and API
export interface InventoryByStatus {
  status: string;
  count: number;
  quantity: number;
}

export interface InventoryByCondition {
  condition: string;
  count: number;
  quantity: number;
}

export interface CategoryBreakdown {
  category_id: string | null;
  category_name: string;
  item_count: number;
  inventory_count: number;
}

export interface LocationBreakdown {
  location_id: string;
  location_name: string;
  inventory_count: number;
  total_quantity: number;
}

export interface LoanStats {
  total_loans: number;
  active_loans: number;
  returned_loans: number;
  overdue_loans: number;
}

export interface AssetValueSummary {
  total_value: number;
  currency_code: string;
  item_count: number;
}

export interface TopBorrower {
  borrower_id: string;
  borrower_name: string;
  active_loans: number;
  total_loans: number;
}

export interface AnalyticsData {
  inventory_by_status: InventoryByStatus[];
  inventory_by_condition: InventoryByCondition[];
  category_breakdown: CategoryBreakdown[];
  location_breakdown: LocationBreakdown[];
  loan_stats: LoanStats;
  asset_value: AssetValueSummary;
  top_borrowers: TopBorrower[];
  total_items: number;
  total_inventory_records: number;
  total_locations: number;
  total_containers: number;
}

export const analyticsApi = {
  getAnalytics: async (): Promise<AnalyticsData> => {
    return apiClient.get<AnalyticsData>('/analytics');
  },
};

// Notification interfaces and API
export interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  workspace_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unread_count: number;
  total_count: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export const notificationsApi = {
  list: async (limit: number = 50, offset: number = 0, unreadOnly: boolean = false): Promise<NotificationListResponse> => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (unreadOnly) {
      params.append('unread_only', 'true');
    }
    return apiClient.get<NotificationListResponse>(`/notifications?${params.toString()}`);
  },

  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    return apiClient.get<UnreadCountResponse>('/notifications/unread-count');
  },

  markAsRead: async (notificationIds?: string[]): Promise<{ marked_count: number }> => {
    return apiClient.post<{ marked_count: number }>('/notifications/mark-read', {
      notification_ids: notificationIds || null,
    });
  },
};

// Favorites interfaces and API
export interface FavoriteWithDetails {
  id: string;
  favorite_type: 'ITEM' | 'LOCATION' | 'CONTAINER';
  entity_id: string;
  entity_name: string;
  entity_description: string | null;
  created_at: string;
}

export interface ToggleFavoriteResponse {
  is_favorited: boolean;
  favorite_id: string | null;
}

export interface CheckFavoriteResponse {
  is_favorited: boolean;
}

export const favoritesApi = {
  list: async (): Promise<FavoriteWithDetails[]> => {
    return apiClient.get<FavoriteWithDetails[]>('/favorites');
  },

  toggle: async (
    favoriteType: 'ITEM' | 'LOCATION' | 'CONTAINER',
    entityId: string
  ): Promise<ToggleFavoriteResponse> => {
    return apiClient.post<ToggleFavoriteResponse>(
      `/favorites/toggle/${favoriteType}/${entityId}`,
      {}
    );
  },

  check: async (
    favoriteType: 'ITEM' | 'LOCATION' | 'CONTAINER',
    entityId: string
  ): Promise<CheckFavoriteResponse> => {
    return apiClient.get<CheckFavoriteResponse>(
      `/favorites/check/${favoriteType}/${entityId}`
    );
  },

  remove: async (
    favoriteType: 'ITEM' | 'LOCATION' | 'CONTAINER',
    entityId: string
  ): Promise<void> => {
    return apiClient.delete(`/favorites/${favoriteType}/${entityId}`);
  },
};

// Export API
export type ExportFormat = 'xlsx' | 'json';

export const exportApi = {
  downloadExport: async (format: ExportFormat = 'xlsx'): Promise<void> => {
    const token = tokenStorage.getToken();
    const workspaceId = workspaceStorage.getWorkspaceId();

    if (!token || !workspaceId) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/exports/workspace?format=${format}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Workspace-ID': workspaceId,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        tokenStorage.removeToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/en/login';
        }
        throw new Error('Authentication required');
      }
      const errorData = await response.json().catch(() => ({ detail: 'Export failed' }));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `warehouse_export.${format}`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) {
        filename = match[1];
      }
    }

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

// Import API
export type EntityType = 'categories' | 'locations' | 'containers' | 'items' | 'borrowers' | 'inventory';

export interface ImportError {
  row: number;
  field: string | null;
  message: string;
}

export interface ImportResult {
  entity_type: string;
  total_rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export interface BarcodeProduct {
  barcode: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  source: string;
}

export interface BarcodeNotFound {
  barcode: string;
  found: false;
  message: string;
}

export const importsApi = {
  upload: async (file: File, entityType: EntityType): Promise<ImportResult> => {
    const token = tokenStorage.getToken();
    const workspaceId = workspaceStorage.getWorkspaceId();

    if (!token || !workspaceId) {
      throw new Error('Authentication required');
    }

    const formData = new FormData();
    formData.append('data', file);
    formData.append('entity_type', entityType);

    const response = await fetch(`${API_BASE_URL}/imports/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Workspace-ID': workspaceId,
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        tokenStorage.removeToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/en/login';
        }
        throw new Error('Authentication required');
      }
      const errorData = await response.json().catch(() => ({ detail: 'Import failed' }));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    return response.json();
  },

  lookupBarcode: async (barcode: string): Promise<BarcodeProduct | BarcodeNotFound> => {
    return apiClient.get<BarcodeProduct | BarcodeNotFound>(`/imports/barcode/${barcode}`);
  },
};

// Token storage utilities
export const tokenStorage = {
  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  },

  getToken: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  },

  removeToken: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  },

  isAuthenticated: (): boolean => {
    return !!tokenStorage.getToken();
  },
};

// Workspace storage utilities
export const workspaceStorage = {
  setWorkspaceId: (workspaceId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('workspace_id', workspaceId);
    }
  },

  getWorkspaceId: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('workspace_id');
    }
    return null;
  },

  removeWorkspaceId: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('workspace_id');
    }
  },
};

// Docspell interfaces and API
export interface DocspellSettings {
  id: string;
  workspace_id: string;
  base_url: string;
  collective_name: string;
  username: string;
  sync_tags_enabled: boolean;
  is_enabled: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocspellSettingsCreate {
  base_url: string;
  collective_name: string;
  username: string;
  password: string;
  sync_tags_enabled?: boolean;
}

export interface DocspellSettingsUpdate {
  base_url?: string;
  collective_name?: string;
  username?: string;
  password?: string;
  sync_tags_enabled?: boolean;
  is_enabled?: boolean;
}

export interface DocspellConnectionTest {
  success: boolean;
  message: string;
  version: string | null;
}

export interface DocspellDocument {
  id: string;
  name: string;
  date: string | null;
  correspondent: string | null;
  tags: string[];
  folder: string | null;
}

export interface DocspellSearchResult {
  items: DocspellDocument[];
  total: number;
}

export interface DocspellTag {
  id: string;
  name: string;
  category: string | null;
}

export interface TagSyncResult {
  tags_created_in_warehouse: number;
  tags_created_in_docspell: number;
  tags_matched: number;
}

export interface ItemAttachment {
  id: string;
  item_id: string;
  attachment_type: 'PHOTO' | 'MANUAL' | 'RECEIPT' | 'WARRANTY' | 'OTHER';
  title: string | null;
  is_primary: boolean;
  docspell_item_id: string | null;
  created_at: string;
  updated_at: string;
  docspell_document: DocspellDocument | null;
}

export interface LinkDocumentRequest {
  docspell_item_id: string;
  attachment_type?: 'PHOTO' | 'MANUAL' | 'RECEIPT' | 'WARRANTY' | 'OTHER';
  title?: string;
}

export const docspellApi = {
  getSettings: async (): Promise<DocspellSettings | null> => {
    try {
      return await apiClient.get<DocspellSettings>('/docspell/settings');
    } catch (error) {
      // Return null if not configured (404)
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  createSettings: async (data: DocspellSettingsCreate): Promise<DocspellSettings> => {
    return apiClient.post<DocspellSettings>('/docspell/settings', data);
  },

  updateSettings: async (data: DocspellSettingsUpdate): Promise<DocspellSettings> => {
    return apiClient.patch<DocspellSettings>('/docspell/settings', data);
  },

  deleteSettings: async (): Promise<void> => {
    return apiClient.delete('/docspell/settings');
  },

  testConnection: async (): Promise<DocspellConnectionTest> => {
    return apiClient.get<DocspellConnectionTest>('/docspell/test');
  },

  searchDocuments: async (query: string, limit: number = 20, offset: number = 0): Promise<DocspellSearchResult> => {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return apiClient.get<DocspellSearchResult>(`/docspell/search?${params.toString()}`);
  },

  getDocument: async (documentId: string): Promise<DocspellDocument | null> => {
    try {
      return await apiClient.get<DocspellDocument>(`/docspell/documents/${documentId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  getTags: async (): Promise<DocspellTag[]> => {
    return apiClient.get<DocspellTag[]>('/docspell/tags');
  },

  syncTags: async (direction: 'to_docspell' | 'from_docspell' | 'both' = 'both'): Promise<TagSyncResult> => {
    return apiClient.post<TagSyncResult>('/docspell/tags/sync', { direction });
  },

  // Item attachment methods
  getItemAttachments: async (itemId: string): Promise<ItemAttachment[]> => {
    return apiClient.get<ItemAttachment[]>(`/docspell/items/${itemId}/attachments`);
  },

  linkDocument: async (itemId: string, data: LinkDocumentRequest): Promise<ItemAttachment> => {
    return apiClient.post<ItemAttachment>(`/docspell/items/${itemId}/attachments`, data);
  },

  unlinkDocument: async (itemId: string, attachmentId: string): Promise<void> => {
    return apiClient.delete(`/docspell/items/${itemId}/attachments/${attachmentId}`);
  },
};

// Error translation utilities
export const getTranslatedErrorMessage = (errorMessage: string, t: (key: string) => string, errorCode?: string): string => {
  // If we have a direct error code from the backend, try to use it first
  if (errorCode) {
    try {
      const translated = t(`errors.${errorCode}`);
      // Check if translation exists (next-intl returns the key if not found)
      if (translated && translated !== `errors.${errorCode}`) {
        return translated;
      }
    } catch {
      // Translation key not found, fall through to message matching
    }
  }

  // Map common backend error messages to error codes
  const errorMappings: Record<string, string> = {
    'Username already exists': 'AUTH_USERNAME_EXISTS',
    'Email already exists': 'AUTH_EMAIL_EXISTS',
    'Invalid credentials': 'AUTH_INVALID_CREDENTIALS',
    'User is inactive': 'AUTH_INACTIVE_USER',
    'Category not found': 'CATEGORY_NOT_FOUND',
    'Item not found': 'ITEM_NOT_FOUND',
    'SKU already exists': 'ITEM_DUPLICATE_SKU',
    'Inventory not found': 'INVENTORY_NOT_FOUND',
    'Inventory record already exists for this item and location': 'INVENTORY_DUPLICATE',
    'Stock cannot be negative': 'INVENTORY_STOCK_NEGATIVE',
    'Location not found': 'LOCATION_NOT_FOUND',
    'Borrower not found': 'BORROWER_NOT_FOUND',
    'Borrower has existing loans': 'BORROWER_HAS_LOANS',
    'Loan not found': 'LOAN_NOT_FOUND',
    'Loan already returned': 'LOAN_ALREADY_RETURNED',
    'Request is invalid': 'GENERAL_BAD_REQUEST',
    'Workspace not found': 'WORKSPACE_NOT_FOUND',
    'Access to workspace denied': 'WORKSPACE_ACCESS_DENIED',
    'Permission denied for this workspace': 'WORKSPACE_PERMISSION_DENIED',
    'User is already a member of this workspace': 'WORKSPACE_MEMBER_EXISTS',
    'Personal workspace cannot be deleted': 'WORKSPACE_PROTECTED',
    'Cannot delete your last workspace': 'WORKSPACE_LAST',
    'Workspace owner cannot be removed': 'WORKSPACE_OWNER_CANNOT_BE_REMOVED',
    'Workspace member not found': 'WORKSPACE_MEMBER_NOT_FOUND',
    'User not found': 'USER_NOT_FOUND',
    // Advanced Alchemy / database errors
    'data validation error': 'DATABASE_CONSTRAINT_ERROR',
    'foreign key': 'DATABASE_FOREIGN_KEY_ERROR',
  };

  // Find the error code from the message
  const messageKey = Object.keys(errorMappings).find(key =>
    errorMessage.toLowerCase().includes(key.toLowerCase())
  );

  if (messageKey) {
    try {
      return t(`errors.${errorMappings[messageKey]}`);
    } catch {
      // Translation key not found, return original message
      return errorMessage;
    }
  }

  // Unknown error, return generic message
  try {
    return t('errors.UNKNOWN_ERROR');
  } catch {
    return errorMessage; // Fallback to original message
  }
};