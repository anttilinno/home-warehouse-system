import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { post, setRefreshToken } from "@/lib/api";
import { purgePersistedCache } from "@/lib/offline/persister";

// useLogout — the AUTH-12 frontend half (05-RESEARCH Pattern 3). Logout that
// ACTUALLY revokes: it POSTs /auth/logout (the backend reads the refresh_token
// cookie and revokes the session — server-side revocation is guarded by Plan
// 01) and then, in a `finally`, UNCONDITIONALLY clears all client auth state and
// navigates to /login. The order matters: the server revoke is attempted first,
// the client cleanup runs in `finally` so a failed/expired POST (network error,
// already-revoked session) STILL logs the user out client-side — logout is never
// navigate-only.
//
// localStorage["workspace_id"] is the D-12 SSOT key (WorkspaceProvider); clearing
// it drops the stale workspace selection so the next login re-heals from scratch.
// queryClient.clear() drops every cached server response so no previous user's
// data lingers in memory after logout.

const WS_KEY = "workspace_id";

export function useLogout(): () => Promise<void> {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      // Best-effort server-side revocation: swallow any failure (network error,
      // already-expired/revoked session, 5xx) — the client cleanup below is
      // unconditional, so a failed POST must NOT reject the logout promise or
      // skip the client logout.
      await post("/auth/logout").catch(() => {});
    } finally {
      setRefreshToken(null);
      localStorage.removeItem(WS_KEY);
      queryClient.clear();
      // Also wipe the persisted IndexedDB cache — queryClient.clear() only
      // clears in-memory state, so without this the next user on the device
      // would still see the prior user's data restored from disk. Same
      // reasoning for the SW's thumbnail cache: it's auth-cookie-gated at
      // fetch time but served without auth afterwards, so it must not survive
      // to the next device user either.
      await purgePersistedCache();
      if (typeof caches !== "undefined") {
        await caches.delete("hws-thumbs").catch(() => {});
      }
      navigate("/login", { replace: true });
    }
  }, [navigate, queryClient]);
}
