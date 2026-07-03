import { useEffect, useRef } from "react";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { get } from "@/lib/api";
import { retroToast } from "@/components/retro";
import type { Workspace } from "@/lib/types";

// Offline-first PWA Phase 2 (AUTH-survival-on-reconnect). On offline→online,
// probe the session by re-fetching the SAME ["workspaces"] query RequireAuth
// already owns (cheapest authed call — no new endpoint) and, once it succeeds,
// drain the paused-mutation queue. A 401 here runs api.ts's existing
// refresh→emitAuthExpired path with zero extra code — RequireAuth's listener
// does the /login redirect, and the queue stays paused (not dropped) until the
// user re-authenticates (see resumePausedMutations calls after setRefreshToken
// in LoginPage/CallbackPage/RegisterPage).
export function useResumeOnReconnect(): void {
  const queryClient = useQueryClient();
  const { t } = useLingui();
  // onlineManager can fire repeatedly in a flappy-connection burst; this ref
  // drops re-entrant probes rather than piling up concurrent fetchQuery calls.
  const isProbing = useRef(false);

  useEffect(() => {
    return onlineManager.subscribe((isOnline) => {
      if (!isOnline || isProbing.current) return;
      isProbing.current = true;

      // Phase 4 sync toast: snapshot the paused queue SYNCHRONOUSLY, before
      // any `await`/`.then()` gap. QueryClientProvider's own `client.mount()`
      // registers ITS OWN onlineManager subscriber that also races to drain
      // paused mutations on this exact same online event — reading the queue
      // after a network round-trip (the session probe below) risks it already
      // being drained by then, silently skipping the toast.
      const paused = queryClient
        .getMutationCache()
        .findAll({ status: "pending" })
        .filter((m) => m.state.isPaused);
      const toastId =
        paused.length > 0
          ? retroToast.loading(t`Syncing ${paused.length} changes…`)
          : undefined;

      queryClient
        .fetchQuery({
          queryKey: ["workspaces"],
          queryFn: () => get<Workspace[]>("/users/me/workspaces"),
        })
        .then(() => queryClient.resumePausedMutations())
        .then(() => {
          if (toastId === undefined) return;
          // ponytail: v1 doesn't track per-mutation settle outcome —
          // mutationCache.resumePausedMutations() swallows individual
          // failures (.catch(noop)) and each offline-create hook's own
          // onError already rolls back + toasts a genuine 4xx failure
          // (Phase 4 conflict policy). Resolve the loading toast to a
          // generic success once the drain promise settles; upgrade to a
          // real settle-outcome toast if that per-item silence bites.
          retroToast.success(t`Synced.`, { id: toastId });
        })
        .catch(() => {
          // Session probe failed (network still bad, or a genuine 401 already
          // routed through emitAuthExpired). ponytail: a loading toast fired
          // above (toastId) is left dangling in this case — rare (a probe
          // failure right after going online) and self-heals on the next
          // successful reconnect toast/dismiss; not worth tracking for v1.
        })
        .finally(() => {
          isProbing.current = false;
        });
    });
  }, [queryClient, t]);
}
