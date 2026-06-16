import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { Workspace } from "@/lib/types";

// WorkspaceProvider — the D-12 single source of truth for the active workspace.
// currentWorkspaceId is app-level state (React context + localStorage), NOT a
// route param. It is initialised from the SHARED ["workspaces"] query (the same
// cache entry RequireAuth + DashboardPage use, so the provider costs no extra
// request), with a first-workspace heal. Switching invalidates entity caches via
// queryClient.invalidateQueries() — never a full-page reload (Pitfall 6: reload
// is jarring and drops the in-memory refresh token).

// localStorage key (D-12; matches the useLogout reset in Plan 05).
const WS_KEY = "workspace_id";

export interface WorkspaceContextValue {
  /** The active workspace id, or null while ["workspaces"] is still pending. */
  currentWorkspaceId: string | null;
  /** Persist + switch the active workspace and invalidate entity caches. */
  setWorkspace: (id: string) => void;
  /** The full workspace list (undefined while loading). */
  workspaces: Workspace[] | undefined;
  /** True while the ["workspaces"] probe is in flight. */
  isLoading: boolean;
}

// Exported for the useWorkspace hook (which owns the outside-provider guard).
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

export function WorkspaceProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();

  // Reuse the existing ["workspaces"] key so RequireAuth's cache is shared.
  const { data: workspaces, isPending } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => get<Workspace[]>("/users/me/workspaces"),
    retry: false,
  });

  // Initialise from localStorage; the heal effect corrects it once the list
  // resolves (null/absent → first workspace).
  const [currentWorkspaceId, setId] = useState<string | null>(() =>
    localStorage.getItem(WS_KEY),
  );

  // Heal: once workspaces resolve, if the current id is null or not in the list,
  // fall back to the first workspace and rewrite localStorage.
  useEffect(() => {
    if (!workspaces?.length) return;
    const valid =
      currentWorkspaceId != null &&
      workspaces.some((w) => w.id === currentWorkspaceId);
    if (!valid) {
      const id = workspaces[0].id;
      localStorage.setItem(WS_KEY, id);
      setId(id);
    }
  }, [workspaces, currentWorkspaceId]);

  const setWorkspace = useCallback(
    (id: string) => {
      localStorage.setItem(WS_KEY, id);
      setId(id);
      // Drop every cached entity so the new workspace's data re-fetches under
      // its own wsId-keyed queries (Pitfall 6 — invalidate, never page-reload).
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspaceId,
        setWorkspace,
        workspaces,
        isLoading: isPending,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
