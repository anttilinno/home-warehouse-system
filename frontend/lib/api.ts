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
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  full_name?: string | null;
  email?: string;
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
  error_type?: string;
  traceback?: string;
  exception_type?: string;
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
      // Handle authentication errors
      if (response.status === 401) {
        // Clear invalid token and redirect to login
        tokenStorage.removeToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/en/login';
        }
        throw new Error('Authentication required');
      }

      const errorData: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));

      // Show error modal for 500 errors in development
      if (response.status >= 500) {
        showServerError(errorData);
      }

      throw new Error(errorData.detail || `HTTP ${response.status}`);
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
        throw new Error('Authentication required');
      }

      const errorData: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));

      // Show error modal for 500 errors in development
      if (response.status >= 500) {
        showServerError(errorData);
      }

      throw new Error(errorData.detail || `HTTP ${response.status}`);
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
        throw new Error('Authentication required');
      }

      const errorData: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));

      if (response.status >= 500) {
        showServerError(errorData);
      }

      throw new Error(errorData.detail || `HTTP ${response.status}`);
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
        throw new Error('Authentication required');
      }

      const errorData: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));

      if (response.status >= 500) {
        showServerError(errorData);
      }

      throw new Error(errorData.detail || `HTTP ${response.status}`);
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
  }) => {
    return apiClient.post('/auth/register', userData);
  },

  getProfile: async (): Promise<User> => {
    return apiClient.get<User>('/auth/me');
  },

  updateProfile: async (data: ProfileUpdate): Promise<User> => {
    return apiClient.patch<User>('/auth/me', data);
  },

  changePassword: async (data: PasswordChange): Promise<User> => {
    return apiClient.post<User>('/auth/me/password', data);
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
  created_at: string;
  updated_at: string;
}

export interface ItemCreate {
  sku: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
}

export interface ItemUpdate {
  name?: string | null;
  description?: string | null;
  category_id?: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface InventoryCreate {
  item_id: string;
  location_id: string;
  quantity: number;
}

export interface InventoryUpdate {
  quantity: number;
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

// Error translation utilities
export const getTranslatedErrorMessage = (errorMessage: string, t: (key: string) => string): string => {
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
    'Workspace owner cannot be removed': 'WORKSPACE_OWNER_CANNOT_BE_REMOVED',
    'Workspace member not found': 'WORKSPACE_MEMBER_NOT_FOUND',
    'User not found': 'USER_NOT_FOUND',
  };

  // Find the error code from the message
  const errorCode = Object.keys(errorMappings).find(key =>
    errorMessage.toLowerCase().includes(key.toLowerCase())
  );

  if (errorCode) {
    try {
      return t(`errors.${errorMappings[errorCode]}`);
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