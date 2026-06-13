import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import type {
  NotificationListResponse,
  UnreadCountResponse,
} from "@/lib/api/notifications";

// Phase 13 Plan 01 — the notifications reads (NOTIF-02 list + NOTIF-03 badge).
// USER-scoped: every key sits UNDER the ["notifications"] prefix (NO wsId) so
// useNotificationMutations' prefix-invalidate covers both. Always `enabled`
// (user-scoped — valid once authed). The unread-count badge polls on a cheap
// `refetchInterval` because there is NO `notification` entry in the SSE
// invalidation map (VALIDATION confirmed); SSE invalidation is a follow-up.

const UNREAD_COUNT_POLL_MS = 30_000;

export interface UseNotificationsResult {
  items: NotificationListResponse["items"];
  total: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Notification list, keyed ["notifications","list",{page,limit}] (no wsId).
 * limit capped at 100 server-side (mirrors the api clamp).
 */
export function useNotificationsQuery(opts?: {
  page?: number;
  limit?: number;
}): UseNotificationsResult {
  const page = opts?.page ?? 1;
  const limit = Math.min(opts?.limit ?? 50, 100);

  const query = useQuery({
    queryKey: ["notifications", "list", { page, limit }],
    queryFn: () => notificationsApi.list({ page, limit }),
    retry: false,
  });

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export interface UseUnreadCountResult {
  count: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Unread-count badge source, keyed ["notifications","unread","count"] (no wsId).
 * Polls every 30s (refetchInterval) — the only freshness mechanism (no SSE
 * notification entry). retry:false keeps a transient 5xx from hammering.
 */
export function useUnreadCountQuery(): UseUnreadCountResult {
  const query = useQuery<UnreadCountResponse>({
    queryKey: ["notifications", "unread", "count"],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: UNREAD_COUNT_POLL_MS,
    retry: false,
  });

  return {
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
