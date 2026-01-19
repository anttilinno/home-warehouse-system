"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Package,
  MapPin,
  Box,
  AlertTriangle,
  HandCoins,
  TrendingUp,
  Clock,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/contexts/auth-context";
import { useSSE, type SSEEvent } from "@/lib/hooks/use-sse";
import { analyticsApi, notificationsApi, type AnalyticsSummary, type RecentActivity } from "@/lib/api";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ActivityFeedMobile } from "@/components/dashboard/activity-feed-mobile";

interface FrontendActivity {
  id: string;
  type: "add" | "move" | "loan" | "return";
  item: string;
  location?: string;
  borrower?: string;
  time: string;
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

function mapActivityToFrontend(activity: RecentActivity): FrontendActivity | null {
  const getActivityType = (action: string, entityType: string): "add" | "move" | "loan" | "return" => {
    const actionLower = action.toLowerCase();
    const entityLower = entityType.toLowerCase();

    if (actionLower === "create" || actionLower === "created") {
      if (entityLower === "loan") return "loan";
      return "add";
    }
    if (actionLower === "move" || actionLower === "moved") return "move";
    if (actionLower === "loan" || actionLower === "loaned") return "loan";
    if (actionLower === "return" || actionLower === "returned") return "return";
    if (actionLower === "update" || actionLower === "updated") return "move";

    return "add"; // default
  };

  return {
    id: activity.id,
    type: getActivityType(activity.action, activity.entity_type),
    item: activity.entity_name || "Unknown Item",
    location: undefined,
    borrower: undefined,
    time: formatRelativeTime(activity.created_at),
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96 mt-2" />
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts and Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-12">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to load dashboard</h3>
            <p className="text-sm text-muted-foreground mb-4">{error || "Unknown error occurred"}</p>
            <Button onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { workspaceId, isLoading: authLoading } = useAuth();

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch analytics summary and notification count in parallel
      const [summaryData, notifCount] = await Promise.all([
        analyticsApi.getSummary(workspaceId),
        notificationsApi.getUnreadCount().catch(() => ({ count: 0 })), // Graceful fallback
      ]);

      setSummary(summaryData);
      setUnreadCount(notifCount.count);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(errorMessage);
      toast.error("Failed to load dashboard", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId && !authLoading) {
      loadDashboardData();
    }
  }, [workspaceId, authLoading, loadDashboardData]);

  // Subscribe to SSE events for real-time updates
  useSSE({
    onEvent: (event: SSEEvent) => {
      // Dashboard shows aggregate stats, refresh on any entity change
      // Silently refresh data without showing toasts to avoid spam
      loadDashboardData();
    }
  });

  // Loading state
  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (error || !summary) {
    return <ErrorState error={error} onRetry={loadDashboardData} />;
  }

  // Extract data from summary
  const stats = summary.dashboard;

  // Map backend activity to frontend format
  const recentActivity = summary.recent_activity
    .map(mapActivityToFrontend)
    .filter((a): a is FrontendActivity => a !== null)
    .slice(0, 4); // Show only 4 most recent

  // Generate alerts dynamically from stats
  const alerts = [];
  if (stats.low_stock_items > 0) {
    alerts.push({
      id: "low_stock",
      type: "low_stock",
      message: t("alerts.lowStock", { count: stats.low_stock_items }),
      severity: "warning" as const,
    });
  }
  if (stats.overdue_loans > 0) {
    alerts.push({
      id: "overdue",
      type: "overdue",
      message: t("alerts.overdueLoans", { count: stats.overdue_loans }),
      severity: "error" as const,
    });
  }
  // Note: Backend doesn't provide expiring items data yet
  // if (expiringItems > 0) {
  //   alerts.push({ id: "expiring", type: "expiring", message: t("alerts.expiring", { count: expiringItems }), severity: "warning" });
  // }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main content (3 columns on desktop) */}
      <div className="lg:col-span-3 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t("stats.totalItems")}
          value={stats.total_items.toLocaleString()}
          icon={Package}
        />
        <StatsCard
          title={t("stats.locations")}
          value={stats.total_locations}
          icon={MapPin}
        />
        <StatsCard
          title={t("stats.containers")}
          value={stats.total_containers}
          icon={Box}
        />
        <StatsCard
          title={t("stats.activeLoans")}
          value={stats.active_loans}
          icon={HandCoins}
        />
        </div>

        {/* Alerts and Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("alerts.title")}
            </CardTitle>
            <CardDescription>{t("alerts.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No alerts at the moment
              </p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm">{alert.message}</span>
                    <Badge
                      variant={alert.severity === "error" ? "destructive" : "secondary"}
                    >
                      {alert.severity === "error" ? t("alerts.urgent") : t("alerts.warning")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t("activity.title")}
            </CardTitle>
            <CardDescription>{t("activity.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent activity
              </p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {activity.type === "add" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                      )}
                      {activity.type === "move" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                          <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      {activity.type === "loan" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                          <HandCoins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                      )}
                      {activity.type === "return" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.item}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.location || activity.borrower || "—"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Activity Feed - Desktop (1 column, sticky) */}
      <aside className="hidden lg:block lg:sticky lg:top-6 lg:h-fit">
        <ActivityFeed />
      </aside>

      {/* Activity Feed - Mobile (floating button) */}
      <div className="lg:hidden">
        <ActivityFeedMobile />
      </div>
    </div>
  );
}
