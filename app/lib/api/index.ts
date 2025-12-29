import { apiClient } from './client';
import {
  TokenResponse,
  LoginRequest,
  User,
  Workspace,
  Item,
  ItemCreate,
  Inventory,
  InventoryCreate,
  StockAdjustment,
  Location,
  Container,
  Category,
  BarcodeProduct,
} from './types';

// Auth API
export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/auth/login', data),

  getMe: () => apiClient.get<User>('/auth/me'),

  getWorkspaces: () => apiClient.get<Workspace[]>('/auth/me/workspaces'),
};

// Items API
export const itemsApi = {
  list: () => apiClient.get<Item[]>('/items'),

  get: (id: string) => apiClient.get<Item>(`/items/${id}`),

  create: (data: ItemCreate) => apiClient.post<Item>('/items', data),

  update: (id: string, data: Partial<ItemCreate>) =>
    apiClient.patch<Item>(`/items/${id}`, data),

  delete: (id: string) => apiClient.delete(`/items/${id}`),
};

// Inventory API
export const inventoryApi = {
  list: () => apiClient.get<Inventory[]>('/inventory'),

  get: (id: string) => apiClient.get<Inventory>(`/inventory/${id}`),

  create: (data: InventoryCreate) =>
    apiClient.post<Inventory>('/inventory', data),

  update: (id: string, data: Partial<InventoryCreate>) =>
    apiClient.patch<Inventory>(`/inventory/${id}`, data),

  adjustStock: (id: string, data: StockAdjustment) =>
    apiClient.patch<Inventory>(`/inventory/${id}/adjust`, data),

  delete: (id: string) => apiClient.delete(`/inventory/${id}`),
};

// Locations API
export const locationsApi = {
  list: () => apiClient.get<Location[]>('/locations'),

  get: (id: string) => apiClient.get<Location>(`/locations/${id}`),
};

// Containers API
export const containersApi = {
  list: () => apiClient.get<Container[]>('/containers'),

  get: (id: string) => apiClient.get<Container>(`/containers/${id}`),

  getByShortCode: async (shortCode: string): Promise<Container | null> => {
    const containers = await apiClient.get<Container[]>('/containers');
    return containers.find((c) => c.short_code === shortCode) || null;
  },
};

// Categories API
export const categoriesApi = {
  list: () => apiClient.get<Category[]>('/categories'),
};

// Barcode API
export const barcodeApi = {
  lookup: (barcode: string) =>
    apiClient.get<BarcodeProduct>(`/imports/barcode/${barcode}`),
};

// Combined API object for convenience
export const api = {
  auth: authApi,
  items: itemsApi,
  inventory: {
    ...inventoryApi,
    adjust: (id: string, adjustment: number) =>
      inventoryApi.adjustStock(id, { adjustment }),
  },
  locations: locationsApi,
  containers: containersApi,
  categories: categoriesApi,
  barcode: barcodeApi,
};

// Re-export types
export * from './types';
