"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useThemed, useThemedClasses } from "@/lib/themed";
import { Icon } from "@/components/icons";
import { notificationsApi, Notification } from "@/lib/api";
import { formatDate as formatDateUtil } from "@/lib/date-utils";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";

export default function NotificationsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const t = useTranslations("notifications");
  const themed = useThemed();
  const classes = useThemedClasses();
  const { PageHeader, EmptyState, Button } = themed;
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
    if (classes.isRetro) {
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={classes.loadingText}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className={`${classes.errorText} mb-4`}>{error}</p>
        <Button
          variant="primary"
          icon="RefreshCw"
          onClick={loadNotifications}
        >
          {t("tryAgain")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={classes.isRetro ? `${unreadCount} UNREAD MESSAGES` : `${t("subtitle")} (${unreadCount} ${t("unread")})`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon="RefreshCw"
              onClick={loadNotifications}
            >
              {t("refresh")}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                icon="CheckCheck"
                onClick={handleMarkAllAsRead}
                disabled={markingAllRead}
              >
                {t("markAllRead")}
              </Button>
            )}
          </div>
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon="Bell"
          message={t("noNotifications")}
          description={t("noNotificationsDescription")}
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={
                classes.isRetro
                  ? `retro-card ${!notification.is_read ? "border-l-8 border-l-primary" : ""}`
                  : `bg-card p-4 rounded-lg border transition-colors ${!notification.is_read ? "border-l-4 border-l-primary bg-muted/30" : ""}`
              }
            >
              <div className={`flex items-start gap-4 ${classes.isRetro ? "p-4" : ""}`}>
                {classes.isRetro ? (
                  <div
                    className="flex-shrink-0 w-12 h-12 flex items-center justify-center border-4 border-border"
                    style={{ backgroundColor: getNotificationIconColor(notification.notification_type, notification.metadata) as string }}
                  >
                    <Icon
                      name={getNotificationIconName(notification.notification_type, notification.metadata)}
                      className="h-6 w-6 text-white"
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 mt-1">
                    <Icon
                      name={getNotificationIconName(notification.notification_type, notification.metadata)}
                      className={`h-5 w-5 ${getNotificationIconColor(notification.notification_type, notification.metadata)}`}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className={
                        classes.isRetro
                          ? `retro-heading ${!notification.is_read ? "font-bold" : ""}`
                          : `font-medium ${!notification.is_read ? "font-semibold" : ""}`
                      }>
                        {notification.title}
                      </h3>
                      <p className={`${classes.bodyText} text-muted-foreground mt-1`}>
                        {notification.message}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className={`${classes.smallText} whitespace-nowrap`}>
                        {formatDate(notification.created_at)}
                      </span>
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={markingRead === notification.id}
                          className={
                            classes.isRetro
                              ? "p-2 border-2 border-border hover:bg-muted transition-colors disabled:opacity-50"
                              : "p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
                          }
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
        <div className={`text-center ${classes.smallText} mt-4 ${classes.isRetro ? "uppercase" : ""}`}>
          {t("showingCount", { showing: notifications.length, total: totalCount })}
        </div>
      )}

      {classes.isRetro && (
        <div className="mt-8 text-center">
          <p className="retro-small text-muted-foreground uppercase">
            You have {unreadCount} new messages
          </p>
        </div>
      )}
    </>
  );
}
