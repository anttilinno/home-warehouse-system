import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";
import { Trans } from "@lingui/react/macro";
import { get, HttpError } from "@/lib/api";
import type { Workspace } from "@/lib/types";

// Minimal route guard for the retro-os sample screens (full AuthProvider is
// Phase 5). Probes the session via the workspaces query — pages underneath
// reuse the same ["workspaces"] cache entry, so this costs no extra request.
export function RequireAuth({ children }: { children: ReactNode }) {
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => get<Workspace[]>("/users/me/workspaces"),
    retry: false,
  });

  if (
    workspaces.error instanceof HttpError &&
    (workspaces.error.status === 401 || workspaces.error.status === 403)
  ) {
    return <Navigate to="/login" replace />;
  }

  if (workspaces.isPending) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="font-mono text-[13px] text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      </main>
    );
  }

  return children;
}
