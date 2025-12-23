"use client";

import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useEffect, useState } from "react";
import {
  dashboardApi,
  DashboardExtendedStats,
  InventorySummary,
  tokenStorage,
} from "@/lib/api";
import { useTranslations } from "next-intl";
import { AlertCard } from "@/components/dashboard/alert-card";

type IconName = keyof typeof LucideIcons;

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("dashboard");
  const [stats, setStats] = useState<DashboardExtendedStats | null>(null);
  const [recentItems, setRecentItems] = useState<InventorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && error?.includes("Authentication required")) {
      router.push("/login");
    }
  }, [error, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && error) {
      if (error.includes("401") || error.includes("Unauthorized")) {
        tokenStorage.removeToken();
        router.push("/login");
      }
    }
  }, [error, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, recentData] = await Promise.all([
        dashboardApi.getExtendedStats(),
        dashboardApi.getRecentlyModified(5),
      ]);
      setStats(statsData);
      setRecentItems(recentData);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const statCards: { name: string; value: string; iconName: IconName }[] = [
    { name: t("totalItems"), value: stats?.total_items.toLocaleString() || "0", iconName: "Box" },
    { name: t("locations"), value: stats?.total_locations.toString() || "0", iconName: "MapPin" },
    { name: t("activeLoans"), value: stats?.active_loans.toString() || "0", iconName: "Users" },
    { name: t("categories"), value: stats?.total_categories.toString() || "0", iconName: "Archive" },
  ];

  const hasAlerts =
    (stats?.low_stock_count || 0) > 0 ||
    (stats?.expiring_soon_count || 0) > 0 ||
    (stats?.warranty_expiring_count || 0) > 0 ||
    (stats?.overdue_loans_count || 0) > 0;

  return (
    <>
      <div className="mb-8 border-l-4 border-primary pl-4 py-1">
        <h1 className="text-4xl font-bold text-foreground leading-none">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            title={stat.name}
            className="bg-card p-3 border-2 border-border shadow-sm cursor-default h-20 flex items-center justify-center"
          >
            <div className="flex items-center justify-center gap-3">
              <Icon name={stat.iconName} className="w-6 h-6 text-primary flex-shrink-0" />
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
        {/* Total Value Card */}
        <div
          title={t("totalValue")}
          className="bg-card p-3 border-2 border-border shadow-sm cursor-default h-20 flex items-center justify-center col-span-2 md:col-span-1"
        >
          <div className="flex items-center justify-center gap-3">
            <Icon name="DollarSign" className="w-6 h-6 text-primary flex-shrink-0" />
            <p className="text-2xl font-bold text-foreground">
              {stats ? formatCurrency(stats.total_inventory_value, stats.currency_code) : "€0"}
            </p>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {hasAlerts && (
        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-4">
            {(stats?.low_stock_count || 0) > 0 && (
              <AlertCard
                iconName="AlertTriangle"
                title={t("lowStock")}
                count={stats?.low_stock_count || 0}
                variant="warning"
                href="/dashboard/inventory?filter=low-stock"
              />
            )}
            {(stats?.expiring_soon_count || 0) > 0 && (
              <AlertCard
                iconName="Clock"
                title={t("expiringSoon")}
                count={stats?.expiring_soon_count || 0}
                variant="warning"
                href="/dashboard/inventory?filter=expiring"
              />
            )}
            {(stats?.warranty_expiring_count || 0) > 0 && (
              <AlertCard
                iconName="Shield"
                title={t("warrantyExpiring")}
                count={stats?.warranty_expiring_count || 0}
                variant="info"
                href="/dashboard/inventory?filter=warranty"
              />
            )}
            {(stats?.overdue_loans_count || 0) > 0 && (
              <AlertCard
                iconName="AlertCircle"
                title={t("overdueLoans")}
                count={stats?.overdue_loans_count || 0}
                variant="destructive"
                href="/dashboard/loans?filter=overdue"
              />
            )}
          </div>
        </div>
      )}

      {/* Recently Modified Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm">
        <h3 className="text-xl font-bold mb-6 uppercase border-b-2 border-dashed border-muted-foreground/40 pb-2 flex items-center gap-2">
          <Icon name="History" className="w-5 h-5" />
          {t("recentlyModified")}
        </h3>
        {recentItems.length === 0 ? (
          <p className="text-muted-foreground">{t("noRecentItems")}</p>
        ) : (
          <div className="space-y-3">
            {recentItems.map((item) => (
              <div key={item.id} onClick={() => router.push(`/dashboard/inventory/${item.id}`)} className="border-2 border-border bg-background p-3 hover:bg-muted transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm">
                <div className="flex-1">
                  <h4 className="font-bold text-base uppercase tracking-tight hover:text-primary transition-colors">
                    {item.item_name}
                  </h4>
                  <div className="text-[10px] uppercase text-muted-foreground flex gap-3 mt-1">
                    <span>{item.location_name}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{item.item_sku}</span>
                  </div>
                </div>
                <div className="flex items-end md:items-center justify-between md:justify-end gap-4">
                  <span className="text-2xl font-bold leading-none">{item.quantity}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {formatRelativeTime(item.updated_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
