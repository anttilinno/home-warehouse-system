import { get, post } from "@/lib/api";

// Phase 13 Plan 01 — USER-scoped notifications api (NOTIF-01/02/03). NOT
// workspace-scoped: every endpoint is `/notifications/...` with NO `{ws}`
// segment, and callers key everything under ["notifications"] (no wsId).
//
// Verified backend DTO (auth/notification/handler.go this planning session):
// - GET  /notifications?page=&limit=   → { items, total, page, total_pages }
// - GET  /notifications/unread         → same envelope
// - GET  /notifications/unread/count   → { count }            (int64 JSON tag `count`)
// - POST /notifications/{id}/read      → 204 (no body)
// - POST /notifications/read-all       → 204 (no body)        (read-all, NOT under an id)
//
// limit is clamped at 100 (server max — ListNotificationsInput maximum:"100").

/** Server enum for NotificationResponse.notification_type. */
export type NotificationType =
  | "LOAN_DUE_SOON"
  | "LOAN_OVERDUE"
  | "LOAN_RETURNED"
  | "LOW_STOCK"
  | "WORKSPACE_INVITE"
  | "MEMBER_JOINED"
  | "SYSTEM";

/** A single notification — field tags verified against NotificationResponse. */
export interface NotificationDTO {
  id: string;
  user_id: string;
  workspace_id?: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/** Paginated list envelope (huma `$schema` key deliberately NOT modelled). */
export interface NotificationListResponse {
  items: NotificationDTO[];
  total: number;
  page: number;
  total_pages: number;
}

export interface UnreadCountResponse {
  count: number;
}

export const notificationsApi = {
  list: (opts?: { page?: number; limit?: number }) => {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 50, 100);
    return get<NotificationListResponse>(
      `/notifications?page=${page}&limit=${limit}`,
    );
  },
  unread: () => get<NotificationListResponse>("/notifications/unread"),
  unreadCount: () => get<UnreadCountResponse>("/notifications/unread/count"),
  markRead: (id: string) => post<void>(`/notifications/${id}/read`),
  markAllRead: () => post<void>("/notifications/read-all"),
};
