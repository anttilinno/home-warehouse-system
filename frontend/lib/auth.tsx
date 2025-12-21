"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage, workspaceStorage, User, Workspace, authApi } from './api';

// Password strength utilities
export interface PasswordStrength {
  score: number; // 0-4
  criteria: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export const checkPasswordStrength = (password: string): PasswordStrength => {
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const metCriteria = Object.values(criteria).filter(Boolean).length;
  const score = Math.min(metCriteria, 4); // Max score of 4

  return { score, criteria };
};

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  login: (token: string, user: User, workspaces: Workspace[]) => void;
  logout: () => void;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated on app start
    const token = tokenStorage.getToken();
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    const storedWorkspaces = typeof window !== 'undefined' ? localStorage.getItem('workspaces') : null;
    const storedWorkspaceId = workspaceStorage.getWorkspaceId();

    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);

        if (storedWorkspaces) {
          const workspacesData = JSON.parse(storedWorkspaces) as Workspace[];
          setWorkspaces(workspacesData);

          // Restore current workspace
          if (storedWorkspaceId) {
            const workspace = workspacesData.find(w => w.id === storedWorkspaceId);
            if (workspace) {
              setCurrentWorkspaceState(workspace);
            } else if (workspacesData.length > 0) {
              // Fallback to first workspace if stored one not found
              setCurrentWorkspaceState(workspacesData[0]);
              workspaceStorage.setWorkspaceId(workspacesData[0].id);
            }
          } else if (workspacesData.length > 0) {
            // No stored workspace, use first one
            setCurrentWorkspaceState(workspacesData[0]);
            workspaceStorage.setWorkspaceId(workspacesData[0].id);
          }
        }
      } catch {
        // Invalid stored user data, clear it
        localStorage.removeItem('user');
        localStorage.removeItem('workspaces');
        tokenStorage.removeToken();
        workspaceStorage.removeWorkspaceId();
      }
    }
    setIsLoading(false);

    // Listen for storage changes (token removed in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' && !e.newValue) {
        setIsAuthenticated(false);
        setUser(null);
        setWorkspaces([]);
        setCurrentWorkspaceState(null);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  const login = (token: string, userData: User, userWorkspaces: Workspace[]) => {
    tokenStorage.setToken(token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('workspaces', JSON.stringify(userWorkspaces));
    setUser(userData);
    setWorkspaces(userWorkspaces);
    setIsAuthenticated(true);

    // Set default workspace (first one)
    if (userWorkspaces.length > 0) {
      setCurrentWorkspaceState(userWorkspaces[0]);
      workspaceStorage.setWorkspaceId(userWorkspaces[0].id);
    }
  };

  const logout = () => {
    tokenStorage.removeToken();
    workspaceStorage.removeWorkspaceId();
    localStorage.removeItem('user');
    localStorage.removeItem('workspaces');
    setUser(null);
    setWorkspaces([]);
    setCurrentWorkspaceState(null);
    setIsAuthenticated(false);
    // Don't redirect here - let the calling component handle the redirect
    // to maintain the current locale
  };

  const setCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    workspaceStorage.setWorkspaceId(workspace.id);
    // Also add to workspaces list if not already there
    if (!workspaces.find(w => w.id === workspace.id)) {
      const newWorkspaces = [...workspaces, workspace];
      setWorkspaces(newWorkspaces);
      localStorage.setItem('workspaces', JSON.stringify(newWorkspaces));
    }
  };

  const refreshWorkspaces = async () => {
    // Re-fetch workspaces from the auth/me endpoint would require a new backend endpoint
    // For now, this is a placeholder that can be called after creating a workspace
    // The setCurrentWorkspace function above already handles adding new workspaces to the list
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, currentWorkspace, workspaces, login, logout, setCurrentWorkspace, refreshWorkspaces }}>
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