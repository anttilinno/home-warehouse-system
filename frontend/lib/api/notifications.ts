import { apiClient } from "./client";

export type NotificationType =
  | "LOAN_DUE_SOON"
  | "LOAN_OVERDUE"
  | "LOAN_RETURNED"
  | "LOW_STOCK"
  | "WORKSPACE_INVITE"
  | "MEMBER_JOINED"
  | "SYSTEM";

export interface Notification {
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

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  page: number;
  total_pages: number;
}

export const notificationsApi = {
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    return apiClient.get<UnreadCountResponse>("/notifications/unread/count");
  },

  getUnread: async (): Promise<Notification[]> => {
    const response = await apiClient.get<NotificationListResponse>("/notifications/unread");
    return response.items;
  },

  getAll: async (page: number = 1, limit: number = 50): Promise<NotificationListResponse> => {
    return apiClient.get<NotificationListResponse>(`/notifications?page=${page}&limit=${limit}`);
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    return apiClient.post(`/notifications/${notificationId}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    return apiClient.post("/notifications/read-all");
  },
};
