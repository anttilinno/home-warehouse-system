import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ApiError } from './types';

const DEFAULT_API_URL = 'http://localhost:8000';

// SecureStore doesn't work on web, use AsyncStorage as fallback
const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

class ApiClient {
  private async getBaseUrl(): Promise<string> {
    const customUrl = await AsyncStorage.getItem('api_base_url');
    return customUrl || DEFAULT_API_URL;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await secureStorage.getItem('auth_token');
    const workspaceId = await AsyncStorage.getItem('workspace_id');

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

  async get<T>(endpoint: string): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(endpoint: string, data: any): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<T>(response);
  }

  async delete(endpoint: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    });

    if (!response.ok) {
      await this.handleError(response);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      await this.handleError(response);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private async handleError(response: Response): Promise<never> {
    const errorData: ApiError = await response.json().catch(() => ({
      detail: 'Unknown error',
    }));

    if (response.status === 401) {
      // Check if there's a token to clear (not a login attempt)
      const token = await secureStorage.getItem('auth_token');
      if (token) {
        await secureStorage.deleteItem('auth_token');
        throw new Error('AUTH_REQUIRED');
      }
      // Login failure - show the actual error message
      throw new Error(errorData.detail || 'Invalid credentials');
    }

    throw new Error(errorData.detail || `HTTP ${response.status}`);
  }
}

export const apiClient = new ApiClient();
