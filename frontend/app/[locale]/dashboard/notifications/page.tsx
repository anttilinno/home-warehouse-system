"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icons";
import { notificationsApi, Notification } from "@/lib/api";
import { formatDate as formatDateUtil } from "@/lib/date-utils";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";
import { RetroPageHeader, RetroEmptyState, RetroButton } from "@/components/retro";

export default function NotificationsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const t = useTranslations("notifications");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);


  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await notificationsApi.list(100, 0, false);
      setNotifications(response.notifications);
      setUnreadCount(response.unread_count);
      setTotalCount(response.total_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
    }
  }, [isAuthenticated]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setMarkingRead(notificationId);
      await notificationsApi.markAsRead([notificationId]);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    } finally {
      setMarkingRead(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAllRead(true);
      await notificationsApi.markAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const getNotificationIconName = (type: string, metadata: Record<string, any> | null): "Crown" | "Shield" | "Eye" | "User" | "Bell" | "Mail" => {
    if (type === "WORKSPACE_INVITE" && metadata?.role) {
      const role = metadata.role;
      if (role === "owner") return "Crown";
      if (role === "admin") return "Shield";
      if (role === "viewer") return "Eye";
      return "User";
    }
    if (type === "MEMBER_JOINED") return "User";
    if (type === "LOAN_DUE_SOON") return "Bell";
    if (type === "LOAN_OVERDUE") return "Bell";
    return "Mail";
  };

  const getNotificationIconColor = (type: string, metadata: Record<string, any> | null) => {
    if (isRetro) {
      if (type === "WORKSPACE_INVITE" && metadata?.role) {
        const role = metadata.role;
        if (role === "owner") return NES_YELLOW;
        if (role === "admin") return NES_BLUE;
        return NES_GREEN;
      }
      if (type === "MEMBER_JOINED") return NES_GREEN;
      if (type === "LOAN_DUE_SOON") return NES_YELLOW;
      if (type === "LOAN_OVERDUE") return NES_RED;
      return NES_BLUE;
    }
    if (type === "WORKSPACE_INVITE" && metadata?.role) {
      const role = metadata.role;
      if (role === "owner") return "text-amber-500";
      if (role === "admin") return "text-blue-500";
      if (role === "viewer") return "text-gray-500";
      return "text-green-500";
    }
    if (type === "MEMBER_JOINED") return "text-green-500";
    if (type === "LOAN_DUE_SOON") return "text-yellow-500";
    if (type === "LOAN_OVERDUE") return "text-red-500";
    return "text-muted-foreground";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("justNow");
    if (diffMins < 60) return t("minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("hoursAgo", { count: diffHours });
    if (diffDays < 7) return t("daysAgo", { count: diffDays });
    return formatDateUtil(dateString, user?.date_format);
  };

  if (authLoading || loading) {
    if (isRetro) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="retro-small uppercase font-bold animate-pulse retro-heading">
            Loading...
          </p>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    if (isRetro) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-primary mb-4 retro-body">{error}</p>
          <RetroButton
            variant="primary"
            icon="RefreshCw"
            onClick={loadNotifications}
          >
            {t("tryAgain")}
          </RetroButton>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={loadNotifications}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Icon name="RefreshCw" className="h-4 w-4" />
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  // Retro NES theme
  if (isRetro) {
    return (
      <>
        <RetroPageHeader
          title={t("title")}
          subtitle={`${unreadCount} UNREAD MESSAGES`}
          actions={
            <div className="flex gap-2">
              <button
                onClick={loadNotifications}
                className="px-3 py-2 bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 transition-colors flex items-center gap-2 retro-small uppercase"
              >
                <Icon name="RefreshCw" className="h-4 w-4" />
                {t("refresh")}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={markingAllRead}
                  className="px-3 py-2 bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 transition-colors flex items-center gap-2 retro-small uppercase disabled:opacity-50"
                >
                  <Icon name="CheckCheck" className="h-4 w-4" />
                  {t("markAllRead")}
                </button>
              )}
            </div>
          }
        />

        {notifications.length === 0 ? (
          <RetroEmptyState
            icon="Bell"
            message={t("noNotifications")}
            description={t("noNotificationsDescription")}
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`retro-card ${
                  !notification.is_read ? "border-l-8 border-l-primary" : ""
                }`}
              >
                <div className="flex items-start gap-4 p-4">
                  <div
                    className="flex-shrink-0 w-12 h-12 flex items-center justify-center border-4 border-border"
                    style={{ backgroundColor: getNotificationIconColor(notification.notification_type, notification.metadata) as string }}
                  >
                    <Icon
                      name={getNotificationIconName(notification.notification_type, notification.metadata)}
                      className="h-6 w-6 text-white"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className={`retro-heading ${!notification.is_read ? "font-bold" : ""}`}>
                          {notification.title}
                        </h3>
                        <p className="retro-body text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="retro-body text-muted-foreground whitespace-nowrap">
                          {formatDate(notification.created_at)}
                        </span>
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            disabled={markingRead === notification.id}
                            className="p-2 border-2 border-border hover:bg-muted transition-colors disabled:opacity-50"
                            title="Mark as read"
                          >
                            <Icon name="Check" className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalCount > notifications.length && (
          <div className="text-center retro-small text-muted-foreground mt-4 uppercase">
            {t("showingCount", { showing: notifications.length, total: totalCount })}
          </div>
        )}

        {/* Retro footer */}
        <div className="mt-8 text-center">
          <p className="retro-small text-muted-foreground uppercase">
            You have {unreadCount} new messages
          </p>
        </div>
      </>
    );
  }

  // Standard theme
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("subtitle")} ({unreadCount} {t("unread")})
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadNotifications}
            className="px-3 py-2 border rounded-lg hover:bg-muted transition-colors flex items-center gap-2 text-sm"
          >
            <Icon name="RefreshCw" className="h-4 w-4" />
            {t("refresh")}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead}
              className="px-3 py-2 border rounded-lg hover:bg-muted transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Icon name="CheckCheck" className="h-4 w-4" />
              {t("markAllRead")}
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-card p-8 rounded-lg border text-center">
          <Icon name="Bell" className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t("noNotifications")}</h3>
          <p className="text-muted-foreground">{t("noNotificationsDescription")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-card p-4 rounded-lg border transition-colors ${
                !notification.is_read ? "border-l-4 border-l-primary bg-muted/30" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <Icon
                    name={getNotificationIconName(notification.notification_type, notification.metadata)}
                    className={`h-5 w-5 ${getNotificationIconColor(notification.notification_type, notification.metadata)}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className={`font-medium ${!notification.is_read ? "font-semibold" : ""}`}>
                        {notification.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(notification.created_at)}
                      </span>
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={markingRead === notification.id}
                          className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
                          title="Mark as read"
                        >
                          <Icon name="Check" className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalCount > notifications.length && (
        <div className="text-center text-sm text-muted-foreground mt-4">
          {t("showingCount", { showing: notifications.length, total: totalCount })}
        </div>
      )}
    </>
  );
}
