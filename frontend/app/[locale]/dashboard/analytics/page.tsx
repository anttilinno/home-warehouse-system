"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { analyticsApi, AnalyticsData } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useThemed, useThemedClasses } from "@/lib/themed";
import {
  Package,
  MapPin,
  Users,
  DollarSign,
  AlertTriangle,
  Boxes,
  FolderTree,
} from "lucide-react";
import { Icon } from "@/components/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";

// Alias for backward compat
const NES_AMBER = NES_YELLOW;

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981",
  IN_USE: "#3b82f6",
  RESERVED: "#f59e0b",
  ON_LOAN: "#8b5cf6",
  IN_TRANSIT: "#06b6d4",
  DISPOSED: "#6b7280",
  MISSING: "#ef4444",
  UNKNOWN: "#9ca3af",
};

const CONDITION_COLORS: Record<string, string> = {
  NEW: "#10b981",
  EXCELLENT: "#22c55e",
  GOOD: "#84cc16",
  FAIR: "#f59e0b",
  POOR: "#f97316",
  DAMAGED: "#ef4444",
  FOR_REPAIR: "#dc2626",
  UNKNOWN: "#9ca3af",
};

// NES-style retro colors for charts
const NES_CHART_COLORS = [
  "#ce372b", // red
  "#209cee", // blue
  "#92cc41", // green
  "#f7d51d", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

const NES_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: NES_GREEN,
  IN_USE: NES_BLUE,
  RESERVED: NES_AMBER,
  ON_LOAN: "#8b5cf6",
  IN_TRANSIT: "#06b6d4",
  DISPOSED: "#6b7280",
  MISSING: NES_RED,
  UNKNOWN: "#9ca3af",
};

const NES_CONDITION_COLORS: Record<string, string> = {
  NEW: NES_GREEN,
  EXCELLENT: "#22c55e",
  GOOD: "#84cc16",
  FAIR: NES_AMBER,
  POOR: "#f97316",
  DAMAGED: NES_RED,
  FOR_REPAIR: "#dc2626",
  UNKNOWN: "#9ca3af",
};

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations("analytics");
  const themed = useThemed();
  const classes = useThemedClasses();
  const { Card, PageHeader, Button, EmptyState } = themed;
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme-appropriate colors
  const chartColors = classes.isRetro ? NES_CHART_COLORS : COLORS;
  const statusColors = classes.isRetro ? NES_STATUS_COLORS : STATUS_COLORS;
  const conditionColors = classes.isRetro ? NES_CONDITION_COLORS : CONDITION_COLORS;

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalytics();
    }
  }, [isAuthenticated]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const analyticsData = await analyticsApi.getAnalytics();
      setData(analyticsData);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load analytics"
      );
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        classes.isRetro && "retro-body"
      )}>
        <div className={classes.loadingText}>{t("loading")}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center min-h-[400px]",
        classes.isRetro && "retro-body"
      )}>
        <p className={cn(
          "mb-4",
          classes.errorText
        )} style={classes.isRetro ? { color: NES_RED } : undefined}>{error}</p>
        <Button onClick={fetchAnalytics} variant="primary">
          {t("tryAgain")}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  return (
    <>
      {/* Header */}
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          iconName="Package"
          icon={Package}
          label={t("totalItems")}
          value={data.total_items.toLocaleString()}
          isRetro={classes.isRetro}
        />
        <StatCard
          iconName="Boxes"
          icon={Boxes}
          label={t("inventoryRecords")}
          value={data.total_inventory_records.toLocaleString()}
          isRetro={classes.isRetro}
        />
        <StatCard
          iconName="MapPin"
          icon={MapPin}
          label={t("locations")}
          value={data.total_locations.toLocaleString()}
          isRetro={classes.isRetro}
        />
        <StatCard
          iconName="DollarSign"
          icon={DollarSign}
          label={t("totalAssetValue")}
          value={formatCurrency(
            data.asset_value.total_value,
            data.asset_value.currency_code
          )}
          isRetro={classes.isRetro}
        />
      </div>

      {/* Loan Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <LoanStatCard
          label={t("totalLoans")}
          value={data.loan_stats.total_loans}
          isRetro={classes.isRetro}
        />
        <LoanStatCard
          label={t("activeLoans")}
          value={data.loan_stats.active_loans}
          color={classes.isRetro ? NES_BLUE : "text-blue-600"}
          isRetro={classes.isRetro}
        />
        <LoanStatCard
          label={t("returnedLoans")}
          value={data.loan_stats.returned_loans}
          color={classes.isRetro ? NES_GREEN : "text-green-600"}
          isRetro={classes.isRetro}
        />
        <LoanStatCard
          label={t("overdueLoans")}
          value={data.loan_stats.overdue_loans}
          color={classes.isRetro ? NES_RED : "text-red-600"}
          showWarning={data.loan_stats.overdue_loans > 0}
          isRetro={classes.isRetro}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Inventory by Status */}
        {data.inventory_by_status.length > 0 && (
          <ChartCard title={t("inventoryByStatus")} isRetro={classes.isRetro}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.inventory_by_status as any[]}
                  dataKey="quantity"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                  strokeWidth={classes.isRetro ? 4 : 1}
                  stroke={classes.isRetro ? "var(--border)" : undefined}
                >
                  {data.inventory_by_status.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        statusColors[entry.status] ||
                        chartColors[index % chartColors.length]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Inventory by Condition */}
        {data.inventory_by_condition.length > 0 && (
          <ChartCard title={t("inventoryByCondition")} isRetro={classes.isRetro}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.inventory_by_condition as any[]}>
                <CartesianGrid
                  strokeDasharray={classes.isRetro ? "4 4" : "3 3"}
                  stroke={classes.isRetro ? "var(--border)" : undefined}
                />
                <XAxis dataKey="condition" tick={{ fontSize: classes.isRetro ? 10 : 12 }} />
                <YAxis tick={{ fontSize: classes.isRetro ? 10 : 12 }} />
                <Tooltip />
                <Bar dataKey="quantity" name={t("quantity")}>
                  {data.inventory_by_condition.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        conditionColors[entry.condition] ||
                        chartColors[index % chartColors.length]
                      }
                      strokeWidth={classes.isRetro ? 4 : 0}
                      stroke={classes.isRetro ? "var(--border)" : undefined}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Category Breakdown */}
        {data.category_breakdown.length > 0 && (
          <ChartCard title={t("categoryBreakdown")} isRetro={classes.isRetro}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.category_breakdown as any[]} layout="vertical">
                <CartesianGrid
                  strokeDasharray={classes.isRetro ? "4 4" : "3 3"}
                  stroke={classes.isRetro ? "var(--border)" : undefined}
                />
                <XAxis type="number" tick={{ fontSize: classes.isRetro ? 10 : 12 }} />
                <YAxis dataKey="category_name" type="category" width={120} tick={{ fontSize: classes.isRetro ? 10 : 12 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="item_count"
                  name={t("items")}
                  fill={classes.isRetro ? NES_BLUE : "#3b82f6"}
                  strokeWidth={classes.isRetro ? 4 : 0}
                  stroke={classes.isRetro ? "var(--border)" : undefined}
                />
                <Bar
                  dataKey="inventory_count"
                  name={t("inventory")}
                  fill={classes.isRetro ? NES_GREEN : "#10b981"}
                  strokeWidth={classes.isRetro ? 4 : 0}
                  stroke={classes.isRetro ? "var(--border)" : undefined}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Location Distribution */}
        {data.location_breakdown.length > 0 && (
          <ChartCard title={t("locationDistribution")} isRetro={classes.isRetro}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.location_breakdown as any[]}>
                <CartesianGrid
                  strokeDasharray={classes.isRetro ? "4 4" : "3 3"}
                  stroke={classes.isRetro ? "var(--border)" : undefined}
                />
                <XAxis dataKey="location_name" tick={{ fontSize: classes.isRetro ? 10 : 12 }} />
                <YAxis tick={{ fontSize: classes.isRetro ? 10 : 12 }} />
                <Tooltip />
                <Bar
                  dataKey="total_quantity"
                  name={t("totalQuantity")}
                  fill="#8b5cf6"
                  strokeWidth={classes.isRetro ? 4 : 0}
                  stroke={classes.isRetro ? "var(--border)" : undefined}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Top Borrowers */}
      {data.top_borrowers.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className={cn(
              "mb-4 flex items-center gap-2",
              classes.isRetro ? "text-sm font-bold uppercase retro-heading" : "text-lg font-semibold"
            )}>
              {classes.isRetro ? (
                <Icon name="Users" className="w-5 h-5" />
              ) : (
                <Users className="w-5 h-5" />
              )}
              {t("topBorrowers")}
            </h3>
            <div className="overflow-x-auto">
              <table className={cn("w-full", classes.isRetro && "retro-body")}>
                <thead>
                  <tr className={cn(
                    classes.isRetro ? "border-b-4 border-border bg-muted/30" : "border-b"
                  )}>
                    <th className={cn(
                      "text-left py-2 px-4",
                      classes.isRetro && "py-3 retro-small uppercase font-bold"
                    )}>{t("borrowerName")}</th>
                    <th className={cn(
                      "text-right py-2 px-4",
                      classes.isRetro && "py-3 retro-small uppercase font-bold"
                    )}>{t("activeLoans")}</th>
                    <th className={cn(
                      "text-right py-2 px-4",
                      classes.isRetro && "py-3 retro-small uppercase font-bold"
                    )}>{t("totalLoans")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_borrowers.map((borrower, index) => (
                    <tr
                      key={borrower.borrower_id}
                      className={cn(
                        classes.isRetro
                          ? (index % 2 === 0 ? "bg-background" : "bg-muted/20")
                          : "border-b hover:bg-muted/50"
                      )}
                    >
                      <td className={cn(
                        "py-2 px-4",
                        classes.isRetro && "py-3 retro-small font-bold"
                      )}>{borrower.borrower_name}</td>
                      <td className={cn(
                        "text-right py-2 px-4",
                        classes.isRetro && "py-3"
                      )}>
                        {classes.isRetro ? (
                          <div className="flex items-center justify-end gap-1">
                            {Array.from({ length: Math.min(borrower.active_loans, 5) }).map((_, i) => (
                              <span key={i} style={{ color: NES_YELLOW }}>●</span>
                            ))}
                            {borrower.active_loans > 5 && (
                              <span className="retro-small font-bold" style={{ color: NES_YELLOW }}>+{borrower.active_loans - 5}</span>
                            )}
                            {borrower.active_loans === 0 && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        ) : (
                          borrower.active_loans
                        )}
                      </td>
                      <td className={cn(
                        "text-right py-2 px-4",
                        classes.isRetro && "py-3"
                      )}>
                        {classes.isRetro ? (
                          <div className="flex items-center justify-end gap-1">
                            {Array.from({ length: Math.min(borrower.total_loans, 5) }).map((_, i) => (
                              <span key={i} style={{ color: NES_BLUE }}>{"\u25C6"}</span>
                            ))}
                            {borrower.total_loans > 5 && (
                              <span className="retro-small font-bold" style={{ color: NES_BLUE }}>+{borrower.total_loans - 5}</span>
                            )}
                          </div>
                        ) : (
                          borrower.total_loans
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {data.total_items === 0 &&
        data.total_inventory_records === 0 &&
        data.total_locations === 0 && (
          <EmptyState
            icon="FolderTree"
            message={t("noData")}
            description={t("noDataDescription")}
          />
        )}
    </>
  );
}

function StatCard({
  icon: StandardIcon,
  iconName,
  label,
  value,
  isRetro,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconName: "Package" | "Boxes" | "MapPin" | "DollarSign";
  label: string;
  value: string;
  isRetro: boolean;
}) {
  if (isRetro) {
    return (
      <div className="bg-card p-4 border-4 border-border retro-shadow flex items-center justify-between gap-3">
        <div>
          <p className="retro-small uppercase font-bold text-muted-foreground hidden xl:block">{label}</p>
          <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-pixel)" }}>{value}</p>
        </div>
        <div className="w-10 h-10 border-4 border-border flex items-center justify-center flex-shrink-0" style={{ backgroundColor: NES_BLUE }} title={label}>
          <Icon name={iconName} className="w-5 h-5 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg border shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <StandardIcon className="w-8 h-8 text-primary" />
      </div>
    </div>
  );
}

function LoanStatCard({
  label,
  value,
  color,
  showWarning,
  isRetro,
}: {
  label: string;
  value: number;
  color?: string;
  showWarning?: boolean;
  isRetro: boolean;
}) {
  const isNesColor = color?.startsWith("#") || color?.startsWith("rgb");

  if (isRetro) {
    return (
      <div className="bg-card p-4 border-4 border-border retro-shadow">
        <p className="retro-small uppercase text-muted-foreground">{label}</p>
        <p
          className="text-3xl font-bold flex items-center gap-2"
          style={{
            fontFamily: "var(--font-pixel)",
            color: isNesColor ? color : undefined,
          }}
        >
          {value}
          {showWarning && <Icon name="AlertTriangle" className="w-5 h-5" />}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card p-4 rounded-lg border">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold flex items-center gap-2", color)}>
        {value}
        {showWarning && <AlertTriangle className="w-5 h-5" />}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  children,
  isRetro,
}: {
  title: string;
  children: React.ReactNode;
  isRetro: boolean;
}) {
  if (isRetro) {
    return (
      <div className="bg-card p-6 border-4 border-border retro-shadow">
        <h3 className="text-sm font-bold uppercase retro-heading mb-4">{title}</h3>
        {children}
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg border">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}
