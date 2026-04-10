import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { get, post, setRefreshToken } from "@/lib/api";
import type { User, AuthTokenResponse, RegisterData } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
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
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const me = await get<User>("/users/me");
      setUser(me);
    } catch {
      setUser(null);
      setRefreshToken(null);
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
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
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
