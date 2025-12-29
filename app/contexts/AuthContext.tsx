import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { authApi, User, Workspace } from '../lib/api';
import { cache } from '../lib/storage/cache';
import { offlineQueue } from '../lib/storage/offline-queue';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const storedUser = await AsyncStorage.getItem('user');
      const storedWorkspaces = await AsyncStorage.getItem('workspaces');
      const workspaceId = await AsyncStorage.getItem('workspace_id');

      if (token && storedUser) {
        const userData: User = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);

        if (storedWorkspaces) {
          const workspacesData: Workspace[] = JSON.parse(storedWorkspaces);
          setWorkspaces(workspacesData);

          if (workspaceId) {
            const workspace = workspacesData.find((w) => w.id === workspaceId);
            if (workspace) {
              setCurrentWorkspaceState(workspace);
            }
          }
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });

    // Store credentials
    await SecureStore.setItemAsync('auth_token', response.access_token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
    await AsyncStorage.setItem('workspaces', JSON.stringify(response.workspaces));

    setUser(response.user);
    setWorkspaces(response.workspaces);
    setIsAuthenticated(true);

    // Auto-select first workspace
    if (response.workspaces.length > 0) {
      await setCurrentWorkspace(response.workspaces[0]);
    }
  };

  const logout = async () => {
    // Clear all stored data
    await SecureStore.deleteItemAsync('auth_token');
    await AsyncStorage.multiRemove(['user', 'workspaces', 'workspace_id']);
    await cache.clear();
    await offlineQueue.clear();

    setUser(null);
    setWorkspaces([]);
    setCurrentWorkspaceState(null);
    setIsAuthenticated(false);

    router.replace('/(auth)/login');
  };

  const setCurrentWorkspace = async (workspace: Workspace) => {
    await AsyncStorage.setItem('workspace_id', workspace.id);
    setCurrentWorkspaceState(workspace);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        currentWorkspace,
        workspaces,
        login,
        logout,
        setCurrentWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
