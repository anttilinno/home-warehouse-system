import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { get, post, setRefreshToken, HttpError } from "@/lib/api";
import { loadCatalog, defaultLocale } from "@/lib/i18n";
import type {
  User,
  AuthTokenResponse,
  RegisterData,
  WorkspaceListResponse,
} from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  workspaceId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const me = await get<User>("/users/me");
      await loadCatalog(me.language ?? defaultLocale);
      setUser(me);
      // Resolve workspace (per D-01)
      const wsRes = await get<WorkspaceListResponse>("/workspaces");
      if (wsRes.items.length > 0) {
        // Prefer personal workspace, fall back to first
        const personal = wsRes.items.find((ws) => ws.is_personal);
        setWorkspaceId(personal ? personal.id : wsRes.items[0].id);
      } else {
        setWorkspaceId(null);
      }
    } catch (err) {
      setUser(null);
      setWorkspaceId(null);
      // Only clear the refresh token on definitive auth rejections (401/403).
      // Transient network failures and server errors do not invalidate the session.
      if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
        setRefreshToken(null);
      }
    }
  }, []);

  // Session restore on mount
  useEffect(() => {
    loadUser().finally(() => setIsLoading(false));
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await post<AuthTokenResponse>("/auth/login", {
        email,
        password,
      });
      setRefreshToken(res.refresh_token);
      await loadUser();
    },
    [loadUser]
  );

  const register = useCallback(
    async (data: RegisterData) => {
      const res = await post<AuthTokenResponse>("/auth/register", data);
      setRefreshToken(res.refresh_token);
      await loadUser();
    },
    [loadUser]
  );

  const logout = useCallback(async () => {
    try {
      await post("/auth/logout");
    } catch {
      // Ignore -- clear local state regardless
    }
    setRefreshToken(null);
    setUser(null);
    setWorkspaceId(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaceId,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
