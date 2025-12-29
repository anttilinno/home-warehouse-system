"use client";

import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link, useRouter } from "@/navigation";
import { useEffect, useState } from "react";
import {
  dashboardApi,
  DashboardExtendedStats,
  InventorySummary,
  tokenStorage,
  locationsApi,
  LocationSummary,
} from "@/lib/api";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

type IconName = keyof typeof LucideIcons;

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("dashboard");
  const { theme, setTheme } = useTheme();
  const isRetro = theme?.startsWith("retro");
  const [stats, setStats] = useState<DashboardExtendedStats | null>(null);
  const [recentItems, setRecentItems] = useState<InventorySummary[]>([]);
  const [locations, setLocations] = useState<LocationSummary[]>([]);
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
      const [statsData, recentData, locationsData] = await Promise.all([
        dashboardApi.getExtendedStats(),
        dashboardApi.getRecentlyModified(5),
        locationsApi.list().catch(() => []),
      ]);
      setStats(statsData);
      setRecentItems(recentData);
      setLocations(locationsData.slice(0, 3));
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
      maximumFractionDigits: 0,
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

  const hasAlerts =
    (stats?.low_stock_count || 0) > 0 ||
    (stats?.overdue_loans_count || 0) > 0;

  // NES color constants (Tailwind can't resolve CSS vars in arbitrary values)
  const NES_GREEN = "#92cc41";
  const NES_BLUE = "#209cee";
  const NES_RED = "#ce372b";

  // NES-style dashboard for retro themes
  if (isRetro) {
    return (
      <>
        {/* Header */}
        <header className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold mb-1">{t("title")}</h1>
            <p className="text-muted-foreground font-mono text-xs">
              &gt; SELECT * FROM INVENTORY WHERE STATUS = 'ACTIVE'
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "retro-dark" ? "retro-light" : "retro-dark")}
              className="h-8 w-8 flex items-center justify-center bg-card border-4 border-border shadow-[3px_3px_0px_0px_var(--border)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_var(--border)] transition-all"
              title={theme === "retro-dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <Icon name={theme === "retro-dark" ? "Sun" : "Moon"} className="w-4 h-4" />
            </button>
            <Link
              href="/dashboard/inventory/new"
              className="h-8 px-3 flex items-center gap-2 text-white border-4 border-border shadow-[3px_3px_0px_0px_var(--border)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_var(--border)] transition-all text-[10px] font-bold uppercase"
              style={{ backgroundColor: NES_BLUE }}
            >
              <Icon name="Plus" className="w-3 h-3" />
              <span className="font-[family-name:var(--font-nes)]">{t("newItem")}</span>
            </Link>
          </div>
        </header>

        {/* Stats Grid - NES Style */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* Total Items */}
          <Link
            href="/dashboard/inventory"
            className="bg-card border-4 border-border p-3 shadow-[3px_3px_0px_0px_var(--border)] flex flex-col justify-between h-24 relative group hover:-translate-y-0.5 transition-transform"
          >
            <div className="absolute top-1 right-1 opacity-20">
              <Icon name="Package" className="w-5 h-5" />
            </div>
            <div className="text-[7px] uppercase text-muted-foreground border-b-2 border-muted pb-1 font-[family-name:var(--font-nes)]">
              {t("totalItems")}
            </div>
            <div>
              <span className="text-2xl font-bold block font-[family-name:var(--font-pixel)]">
                {stats?.total_items.toLocaleString() || "0"}
              </span>
              <span className="text-[10px] font-bold font-[family-name:var(--font-nes)]" style={{ color: NES_GREEN }}>
                ▲ {t("inStock")}
              </span>
            </div>
          </Link>

          {/* Low Stock */}
          <Link
            href="/dashboard/inventory?filter=low-stock"
            className="bg-card border-4 border-border p-3 shadow-[3px_3px_0px_0px_var(--border)] flex flex-col justify-between h-24 relative group hover:-translate-y-0.5 transition-transform"
          >
            <div className="absolute top-1 right-1 opacity-20">
              <Icon name="AlertTriangle" className="w-5 h-5 text-primary" />
            </div>
            <div className="text-[7px] uppercase text-muted-foreground border-b-2 border-muted pb-1 font-[family-name:var(--font-nes)]">
              {t("lowStock")}
            </div>
            <div>
              <span className="text-2xl font-bold text-primary block font-[family-name:var(--font-pixel)]">
                {stats?.low_stock_count || 0}
              </span>
              {(stats?.low_stock_count || 0) > 0 && (
                <span className="text-[8px] text-primary font-bold animate-pulse font-[family-name:var(--font-nes)]">
                  !!! {t("urgent")} !!!
                </span>
              )}
            </div>
          </Link>

          {/* Active Loans */}
          <Link
            href="/dashboard/loans"
            className="bg-card border-4 border-border p-3 shadow-[3px_3px_0px_0px_var(--border)] flex flex-col justify-between h-24 relative group hover:-translate-y-0.5 transition-transform"
          >
            <div className="absolute top-1 right-1 opacity-20">
              <Icon name="Users" className="w-5 h-5" />
            </div>
            <div className="text-[7px] uppercase text-muted-foreground border-b-2 border-muted pb-1 font-[family-name:var(--font-nes)]">
              {t("activeLoans")}
            </div>
            <div>
              <span className="text-2xl font-bold block font-[family-name:var(--font-pixel)]">
                {stats?.active_loans || 0}
              </span>
              <span className="text-[10px] text-muted-foreground font-[family-name:var(--font-nes)]">
                {t("dueSoon")}
              </span>
            </div>
          </Link>

          {/* Total Value */}
          <Link
            href="/dashboard/analytics"
            className="bg-card border-4 border-border p-3 shadow-[3px_3px_0px_0px_var(--border)] flex flex-col justify-between h-24 relative group hover:-translate-y-0.5 transition-transform"
          >
            <div className="absolute top-1 right-1 opacity-20">
              <Icon name="DollarSign" className="w-5 h-5" />
            </div>
            <div className="text-[7px] uppercase text-muted-foreground border-b-2 border-muted pb-1 font-[family-name:var(--font-nes)]">
              {t("score")}
            </div>
            <div>
              <span className="text-2xl font-bold block font-[family-name:var(--font-pixel)]">
                {stats ? formatCurrency(stats.total_inventory_value, stats.currency_code) : "€0"}
              </span>
              <span className="text-[10px] text-muted-foreground font-[family-name:var(--font-nes)]">
                {t("credits")}
              </span>
            </div>
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Recent Activity & Alert */}
          <div className="lg:col-span-2 space-y-4">
            {/* Recent Activity Table */}
            <div className="bg-card border-4 border-border shadow-[3px_3px_0px_0px_var(--border)]">
              <div className="border-b-4 border-border px-3 py-2 bg-secondary flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Icon name="History" className="w-3 h-3" />
                  <h2 className="font-bold uppercase text-[10px] font-[family-name:var(--font-nes)]">{t("recentActivity")}</h2>
                </div>
                <Link href="/dashboard/inventory" className="text-[10px] font-bold hover:text-primary underline font-[family-name:var(--font-nes)]">
                  {t("viewAll")}
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b-4 border-border text-[8px] uppercase text-muted-foreground bg-muted font-[family-name:var(--font-nes)]">
                      <th className="px-3 py-2 font-bold">{t("item")}</th>
                      <th className="px-3 py-2 font-bold">{t("action")}</th>
                      <th className="px-3 py-2 font-bold">{t("location")}</th>
                      <th className="px-3 py-2 font-bold text-right">{t("time")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-muted-foreground text-xs">
                          {t("noRecentItems")}
                        </td>
                      </tr>
                    ) : (
                      recentItems.map((item, index) => (
                        <tr
                          key={item.id}
                          onClick={() => router.push(`/dashboard/inventory/${item.id}`)}
                          className="border-b border-dashed border-muted hover:bg-muted/50 cursor-pointer"
                        >
                          <td className="px-3 py-2 font-medium flex items-center gap-2">
                            <div
                              className="w-6 h-6 border-2 border-border flex items-center justify-center"
                              style={{ backgroundColor: `${NES_BLUE}30` }}
                            >
                              <Icon name="Package" className="w-3 h-3" style={{ color: NES_BLUE }} />
                            </div>
                            <span className="truncate max-w-[120px] text-xs">{item.item_name}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="px-2 py-0.5 text-[8px] font-bold border-2 border-border uppercase text-white font-[family-name:var(--font-nes)]"
                              style={{
                                backgroundColor: index % 3 === 0 ? NES_GREEN : index % 3 === 1 ? NES_RED : "#6c757d"
                              }}
                            >
                              {index % 3 === 0 ? t("checkIn") : index % 3 === 1 ? t("loaned") : t("added")}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[80px]">
                            {item.location_name}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                            {formatRelativeTime(item.updated_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Alert Box - Boss Battle Style */}
            {hasAlerts && (
              <div className="border-4 border-primary bg-primary/10 p-3 shadow-[3px_3px_0px_0px_var(--border)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary flex-shrink-0 border-4 border-border flex items-center justify-center">
                    <Icon name="AlertTriangle" className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-primary uppercase text-[10px] font-[family-name:var(--font-nes)]">
                      ! {t("bossAlert")} !
                    </h3>
                    <p className="text-xs text-foreground">
                      {(stats?.low_stock_count || 0) > 0 && (
                        <span>{stats?.low_stock_count} {t("itemsLowStock")}. </span>
                      )}
                      {(stats?.overdue_loans_count || 0) > 0 && (
                        <span>{stats?.overdue_loans_count} {t("overdueLoans")}. </span>
                      )}
                      {t("completeOrLose")}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/inventory?filter=low-stock"
                  className="inline-block bg-primary hover:bg-primary/80 text-white text-[8px] font-bold px-3 py-1.5 uppercase border-2 border-border shadow-[2px_2px_0px_0px_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all font-[family-name:var(--font-nes)]"
                >
                  {t("startAudit")}
                </Link>
              </div>
            )}
          </div>

          {/* Right Column - Quick Actions & Storage */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="bg-card border-4 border-border shadow-[3px_3px_0px_0px_var(--border)] p-3">
              <h2 className="font-bold uppercase text-[10px] mb-3 flex items-center gap-2 border-b-2 border-border pb-2 font-[family-name:var(--font-nes)]">
                <Icon name="Zap" className="w-3 h-3" style={{ color: NES_BLUE }} />
                {t("quickActions")}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/dashboard/inventory/new"
                  className="flex flex-col items-center justify-center p-2 border-4 border-border hover:text-white transition-colors group bg-card"
                  style={{ ["--hover-bg" as string]: NES_BLUE }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = NES_BLUE}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}
                >
                  <Icon name="QrCode" className="w-5 h-5 mb-1" />
                  <span className="text-[8px] font-bold uppercase font-[family-name:var(--font-nes)]">{t("scan")}</span>
                </Link>
                <Link
                  href="/dashboard/analytics"
                  className="flex flex-col items-center justify-center p-2 border-4 border-border hover:text-white transition-colors group bg-card"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = NES_GREEN}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}
                >
                  <Icon name="FileText" className="w-5 h-5 mb-1" />
                  <span className="text-[8px] font-bold uppercase font-[family-name:var(--font-nes)]">{t("report")}</span>
                </Link>
                <Link
                  href="/dashboard/items/new"
                  className="flex flex-col items-center justify-center p-2 border-4 border-border hover:bg-muted transition-colors group bg-card"
                >
                  <Icon name="Upload" className="w-5 h-5 mb-1" />
                  <span className="text-[8px] font-bold uppercase font-[family-name:var(--font-nes)]">{t("import")}</span>
                </Link>
                <Link
                  href="/dashboard/borrowers/new"
                  className="flex flex-col items-center justify-center p-2 border-4 border-border hover:text-white transition-colors group bg-card"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = NES_RED}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}
                >
                  <Icon name="UserPlus" className="w-5 h-5 mb-1" />
                  <span className="text-[8px] font-bold uppercase font-[family-name:var(--font-nes)]">{t("invite")}</span>
                </Link>
              </div>
            </div>

            {/* Storage HP */}
            <div className="bg-card border-4 border-border shadow-[3px_3px_0px_0px_var(--border)]">
              <div className="border-b-4 border-border px-3 py-2 bg-secondary flex justify-between items-center">
                <h2 className="font-bold uppercase text-[10px] font-[family-name:var(--font-nes)]">{t("storageHP")}</h2>
                <span className="bg-primary text-white text-[8px] px-1.5 py-0.5 border-2 border-border font-bold font-[family-name:var(--font-nes)]">
                  HQ
                </span>
              </div>
              <div className="p-3 space-y-3">
                {locations.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-[family-name:var(--font-pixel)]">{t("noLocations")}</p>
                ) : (
                  locations.map((location, index) => {
                    const capacity = 100;
                    const used = Math.min((location.inventory_count || 0), capacity);
                    const percentage = Math.round((used / capacity) * 100);
                    const barColor = index === 0 ? NES_GREEN : index === 1 ? NES_BLUE : NES_RED;

                    return (
                      <div key={location.id}>
                        <div className="flex justify-between text-[10px] mb-1 font-bold font-[family-name:var(--font-nes)]">
                          <span className="truncate max-w-[100px]">{location.name}</span>
                          <span className="font-[family-name:var(--font-pixel)]">{used}/{capacity}</span>
                        </div>
                        <div className="h-4 w-full border-4 border-border bg-card relative">
                          <div
                            className="h-full absolute top-0 left-0 transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: barColor,
                            }}
                          />
                          <div
                            className="w-full h-full absolute top-0 left-0"
                            style={{
                              backgroundImage: "linear-gradient(90deg, transparent 50%, rgba(0,0,0,0.1) 50%)",
                              backgroundSize: "6px 100%",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
                <p className="text-[10px] text-muted-foreground border-t border-dashed border-muted pt-2 font-[family-name:var(--font-pixel)]">
                  &gt; TIP: {t("storageTip")}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2">
              <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-bold font-[family-name:var(--font-nes)]">
                INSERT COIN TO CONTINUE<br/>
                © 2024 HMS CORP
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Standard dashboard for non-retro themes
  const statCards: { name: string; value: string; iconName: IconName; href: string }[] = [
    { name: t("totalItems"), value: stats?.total_items.toLocaleString() || "0", iconName: "Box", href: "/dashboard/inventory" },
    { name: t("locations"), value: stats?.total_locations.toString() || "0", iconName: "MapPin", href: "/dashboard/locations" },
    { name: t("activeLoans"), value: stats?.active_loans.toString() || "0", iconName: "Users", href: "/dashboard/loans" },
    { name: t("categories"), value: stats?.total_categories.toString() || "0", iconName: "Archive", href: "/dashboard/categories" },
  ];

  const standardHasAlerts =
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
          <Link
            key={stat.name}
            href={stat.href}
            title={stat.name}
            className="bg-card p-3 border-2 border-border shadow-sm h-20 flex items-center justify-center hover:bg-muted hover:border-primary transition-colors rounded-lg"
          >
            <div className="flex items-center justify-center gap-3">
              <Icon name={stat.iconName} className="w-6 h-6 text-primary flex-shrink-0" />
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </div>
          </Link>
        ))}
        {/* Total Value Card */}
        <Link
          href="/dashboard/inventory"
          title={t("totalValue")}
          className="bg-card p-3 border-2 border-border shadow-sm h-20 flex items-center justify-center col-span-2 md:col-span-1 hover:bg-muted hover:border-primary transition-colors rounded-lg"
        >
          <div className="flex items-center justify-center gap-3">
            <Icon name="DollarSign" className="w-6 h-6 text-primary flex-shrink-0" />
            <p className="text-2xl font-bold text-foreground">
              {stats ? formatCurrency(stats.total_inventory_value, stats.currency_code) : "€0"}
            </p>
          </div>
        </Link>
      </div>

      {/* Alerts Section */}
      {standardHasAlerts && (
        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-4">
            {(stats?.low_stock_count || 0) > 0 && (
              <Link
                href="/dashboard/inventory?filter=low-stock"
                className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg border border-yellow-200"
              >
                <Icon name="AlertTriangle" className="w-4 h-4" />
                <span className="font-medium">{stats?.low_stock_count} {t("lowStock")}</span>
              </Link>
            )}
            {(stats?.expiring_soon_count || 0) > 0 && (
              <Link
                href="/dashboard/inventory?filter=expiring"
                className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg border border-yellow-200"
              >
                <Icon name="Clock" className="w-4 h-4" />
                <span className="font-medium">{stats?.expiring_soon_count} {t("expiringSoon")}</span>
              </Link>
            )}
            {(stats?.warranty_expiring_count || 0) > 0 && (
              <Link
                href="/dashboard/inventory?filter=warranty"
                className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg border border-blue-200"
              >
                <Icon name="Shield" className="w-4 h-4" />
                <span className="font-medium">{stats?.warranty_expiring_count} {t("warrantyExpiring")}</span>
              </Link>
            )}
            {(stats?.overdue_loans_count || 0) > 0 && (
              <Link
                href="/dashboard/loans?filter=overdue"
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg border border-red-200"
              >
                <Icon name="AlertCircle" className="w-4 h-4" />
                <span className="font-medium">{stats?.overdue_loans_count} {t("overdueLoans")}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recently Modified Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg">
        <h3 className="text-xl font-bold mb-6 border-b border-border pb-2 flex items-center gap-2">
          <Icon name="History" className="w-5 h-5" />
          {t("recentlyModified")}
        </h3>
        {recentItems.length === 0 ? (
          <p className="text-muted-foreground">{t("noRecentItems")}</p>
        ) : (
          <div className="space-y-3">
            {recentItems.map((item) => (
              <div key={item.id} onClick={() => router.push(`/dashboard/inventory/${item.id}`)} className="border border-border bg-background p-3 hover:bg-muted transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-bold text-base hover:text-primary transition-colors">
                    {item.item_name}
                  </h4>
                  <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                    <span>{item.location_name}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{item.item_sku}</span>
                  </div>
                </div>
                <div className="flex items-end md:items-center justify-between md:justify-end gap-4">
                  <span className="text-2xl font-bold leading-none">{item.quantity}</span>
                  <span className="text-xs text-muted-foreground">
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
