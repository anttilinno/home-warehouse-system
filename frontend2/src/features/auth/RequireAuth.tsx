import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router";
import { Trans } from "@lingui/react/macro";
import { get, HttpError } from "@/lib/api";
import { BevelButton } from "@/components/retro";
import type { Workspace } from "@/lib/types";

// Minimal route guard for the retro-os sample screens (full AuthProvider is
// Phase 5). Probes the session via the workspaces query — pages underneath
// reuse the same ["workspaces"] cache entry, so this costs no extra request.
export function RequireAuth({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => get<Workspace[]>("/users/me/workspaces"),
    retry: false,
  });

  // Single consumer of the api.ts `auth-expired` event (emitted once on refresh
  // failure). A gone session anywhere in the app redirects here — one listener,
  // no scattered logout. Cleanup avoids a leaked listener / double-navigation.
  useEffect(() => {
    const handler = () => navigate("/login", { replace: true });
    window.addEventListener("auth-expired", handler);
    return () => window.removeEventListener("auth-expired", handler);
  }, [navigate]);

  // 401/403 → the session is genuinely gone: redirect. This MUST be the first
  // check so an HttpError 403 never falls through to the retry surface.
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

  // Network error or 5xx → the session may still be valid; do NOT log out (the
  // v2.0 spurious-logout regression). Offer a retry that refetches the probe.
  if (workspaces.isError) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div
          role="alert"
          className="flex max-w-sm flex-col items-center gap-sp-4 text-center"
        >
          <p className="font-mono text-[13px] text-fg-muted">
            <Trans>
              Couldn't reach the server. Check your connection and retry.
            </Trans>
          </p>
          <BevelButton onClick={() => workspaces.refetch()}>
            <Trans>Retry</Trans>
          </BevelButton>
        </div>
      </main>
    );
  }

  return children;
}
