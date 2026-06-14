import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { notificationsApi } from "@/lib/api/notifications";
import { retroToast } from "@/components/retro";

// Phase 13 Plan 01 — the notification write surface (NOTIF-02 mark-read).
// USER-scoped: invalidates the ["notifications"] PREFIX (covers the list AND
// the ["notifications","unread","count"] badge key) on every settle, so the
// SERVER read state wins. Mirrors useRepairMutations' onError discipline: a
// persistent retroToast.error, no client-trusted state on failure. `t` is read
// through useLingui at hook scope (stable enough for the toast call sites —
// Pitfall 6 only bites for closures captured into long-lived refs).

export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const { t } = useLingui();

  // Prefix-match (default exact:false) — covers list + unread + unread/count.
  const prefix: QueryKey = ["notifications"];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: prefix });
  }

  const markRead = useMutation<void, Error, string>({
    mutationFn: (id) => notificationsApi.markRead(id),
    onError: () => {
      retroToast.error(t`Couldn't mark this notification read.`);
    },
    onSettled: invalidate,
  });

  const markAllRead = useMutation<void, Error, void>({
    mutationFn: () => notificationsApi.markAllRead(),
    onError: () => {
      retroToast.error(t`Couldn't mark all notifications read.`);
    },
    onSettled: invalidate,
  });

  return { markRead, markAllRead };
}
