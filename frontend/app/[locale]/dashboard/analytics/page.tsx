"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { analyticsApi, AnalyticsData } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  BarChart3,
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
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        isRetro && "retro-body"
      )}>
        <div className={cn(
          "text-muted-foreground",
          isRetro && "retro-small uppercase"
        )}>{t("loading")}</div>
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
        isRetro && "retro-body"
      )}>
        <p className={cn(
          "mb-4",
          isRetro ? "retro-small uppercase" : "text-red-500"
        )} style={isRetro ? { color: NES_RED } : undefined}>{error}</p>
        <button
          onClick={fetchAnalytics}
          className={cn(
            isRetro
              ? "px-4 py-2 border-4 border-border bg-primary text-white retro-small uppercase font-bold retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              : "px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          )}
        >
          {t("tryAgain")}
        </button>
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

  // Retro theme UI
  if (isRetro) {
    return (
      <>
        {/* Header */}
        <div className="mb-8">
          <div className="bg-primary p-4 border-4 border-border retro-shadow">
            <h1 className="text-lg font-bold text-white uppercase retro-heading">
              {t("title")}
            </h1>
            <p className="text-white/80 retro-body retro-small uppercase mt-1">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <RetroStatCard
            iconName="Package"
            label={t("totalItems")}
            value={data.total_items.toLocaleString()}
          />
          <RetroStatCard
            iconName="Boxes"
            label={t("inventoryRecords")}
            value={data.total_inventory_records.toLocaleString()}
          />
          <RetroStatCard
            iconName="MapPin"
            label={t("locations")}
            value={data.total_locations.toLocaleString()}
          />
          <RetroStatCard
            iconName="DollarSign"
            label={t("totalAssetValue")}
            value={formatCurrency(
              data.asset_value.total_value,
              data.asset_value.currency_code
            )}
          />
        </div>

        {/* Loan Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card p-4 border-4 border-border retro-shadow">
            <p className="retro-small uppercase text-muted-foreground">{t("totalLoans")}</p>
            <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-pixel)" }}>{data.loan_stats.total_loans}</p>
          </div>
          <div className="bg-card p-4 border-4 border-border retro-shadow">
            <p className="retro-small uppercase text-muted-foreground">{t("activeLoans")}</p>
            <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-pixel)", color: NES_BLUE }}>
              {data.loan_stats.active_loans}
            </p>
          </div>
          <div className="bg-card p-4 border-4 border-border retro-shadow">
            <p className="retro-small uppercase text-muted-foreground">{t("returnedLoans")}</p>
            <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-pixel)", color: NES_GREEN }}>
              {data.loan_stats.returned_loans}
            </p>
          </div>
          <div className="bg-card p-4 border-4 border-border retro-shadow">
            <p className="retro-small uppercase text-muted-foreground">{t("overdueLoans")}</p>
            <p className="text-3xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-pixel)", color: NES_RED }}>
              {data.loan_stats.overdue_loans}
              {data.loan_stats.overdue_loans > 0 && (
                <Icon name="AlertTriangle" className="w-5 h-5" />
              )}
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Inventory by Status */}
          {data.inventory_by_status.length > 0 && (
            <RetroChartCard title={t("inventoryByStatus")}>
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
                    strokeWidth={4}
                    stroke="var(--border)"
                  >
                    {data.inventory_by_status.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          NES_STATUS_COLORS[entry.status] ||
                          NES_CHART_COLORS[index % NES_CHART_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </RetroChartCard>
          )}

          {/* Inventory by Condition */}
          {data.inventory_by_condition.length > 0 && (
            <RetroChartCard title={t("inventoryByCondition")}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.inventory_by_condition as any[]}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis dataKey="condition" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="quantity" name={t("quantity")}>
                    {data.inventory_by_condition.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          NES_CONDITION_COLORS[entry.condition] ||
                          NES_CHART_COLORS[index % NES_CHART_COLORS.length]
                        }
                        strokeWidth={4}
                        stroke="var(--border)"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </RetroChartCard>
          )}

          {/* Category Breakdown */}
          {data.category_breakdown.length > 0 && (
            <RetroChartCard title={t("categoryBreakdown")}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.category_breakdown as any[]} layout="vertical">
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="category_name" type="category" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="item_count" name={t("items")} fill={NES_BLUE} strokeWidth={4} stroke="var(--border)" />
                  <Bar dataKey="inventory_count" name={t("inventory")} fill={NES_GREEN} strokeWidth={4} stroke="var(--border)" />
                </BarChart>
              </ResponsiveContainer>
            </RetroChartCard>
          )}

          {/* Location Distribution */}
          {data.location_breakdown.length > 0 && (
            <RetroChartCard title={t("locationDistribution")}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.location_breakdown as any[]}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis dataKey="location_name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar
                    dataKey="total_quantity"
                    name={t("totalQuantity")}
                    fill="#8b5cf6"
                    strokeWidth={4}
                    stroke="var(--border)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </RetroChartCard>
          )}
        </div>

        {/* Top Borrowers */}
        {data.top_borrowers.length > 0 && (
          <div className="bg-card p-6 border-4 border-border retro-shadow">
            <h3 className="text-sm font-bold uppercase retro-heading mb-4 flex items-center gap-2">
              <Icon name="Users" className="w-5 h-5" />
              {t("topBorrowers")}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full retro-body">
                <thead>
                  <tr className="border-b-4 border-border bg-muted/30">
                    <th className="text-left py-3 px-4 retro-small uppercase font-bold">{t("borrowerName")}</th>
                    <th className="text-right py-3 px-4 retro-small uppercase font-bold">{t("activeLoans")}</th>
                    <th className="text-right py-3 px-4 retro-small uppercase font-bold">{t("totalLoans")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_borrowers.map((borrower, index) => (
                    <tr
                      key={borrower.borrower_id}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <td className="py-3 px-4 retro-small font-bold">{borrower.borrower_name}</td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {Array.from({ length: Math.min(borrower.active_loans, 5) }).map((_, i) => (
                            <span key={i} style={{ color: NES_YELLOW }}>●</span>
                          ))}
                          {borrower.active_loans > 5 && (
                            <span className="retro-small font-bold" style={{ color: NES_YELLOW }}>+{borrower.active_loans - 5}</span>
                          )}
                          {borrower.active_loans === 0 && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {Array.from({ length: Math.min(borrower.total_loans, 5) }).map((_, i) => (
                            <span key={i} style={{ color: NES_BLUE }}>◆</span>
                          ))}
                          {borrower.total_loans > 5 && (
                            <span className="retro-small font-bold" style={{ color: NES_BLUE }}>+{borrower.total_loans - 5}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {data.total_items === 0 &&
          data.total_inventory_records === 0 &&
          data.total_locations === 0 && (
            <div className="bg-card p-8 border-4 border-border retro-shadow text-center">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-border flex items-center justify-center" style={{ backgroundColor: NES_BLUE }}>
                <Icon name="FolderTree" className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-sm font-bold uppercase retro-heading mb-2">{t("noData")}</h3>
              <p className="text-muted-foreground retro-small uppercase retro-body">{t("noDataDescription")}</p>
            </div>
          )}
      </>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Package}
          label={t("totalItems")}
          value={data.total_items.toLocaleString()}
        />
        <StatCard
          icon={Boxes}
          label={t("inventoryRecords")}
          value={data.total_inventory_records.toLocaleString()}
        />
        <StatCard
          icon={MapPin}
          label={t("locations")}
          value={data.total_locations.toLocaleString()}
        />
        <StatCard
          icon={DollarSign}
          label={t("totalAssetValue")}
          value={formatCurrency(
            data.asset_value.total_value,
            data.asset_value.currency_code
          )}
        />
      </div>

      {/* Loan Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">{t("totalLoans")}</p>
          <p className="text-2xl font-bold">{data.loan_stats.total_loans}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">{t("activeLoans")}</p>
          <p className="text-2xl font-bold text-blue-600">
            {data.loan_stats.active_loans}
          </p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">{t("returnedLoans")}</p>
          <p className="text-2xl font-bold text-green-600">
            {data.loan_stats.returned_loans}
          </p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">{t("overdueLoans")}</p>
          <p className="text-2xl font-bold text-red-600 flex items-center gap-2">
            {data.loan_stats.overdue_loans}
            {data.loan_stats.overdue_loans > 0 && (
              <AlertTriangle className="w-5 h-5" />
            )}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Inventory by Status */}
        {data.inventory_by_status.length > 0 && (
          <ChartCard title={t("inventoryByStatus")}>
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
                >
                  {data.inventory_by_status.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        STATUS_COLORS[entry.status] ||
                        COLORS[index % COLORS.length]
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
          <ChartCard title={t("inventoryByCondition")}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.inventory_by_condition as any[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="condition" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" name={t("quantity")}>
                  {data.inventory_by_condition.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        CONDITION_COLORS[entry.condition] ||
                        COLORS[index % COLORS.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Category Breakdown */}
        {data.category_breakdown.length > 0 && (
          <ChartCard title={t("categoryBreakdown")}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.category_breakdown as any[]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="category_name" type="category" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="item_count" name={t("items")} fill="#3b82f6" />
                <Bar
                  dataKey="inventory_count"
                  name={t("inventory")}
                  fill="#10b981"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Location Distribution */}
        {data.location_breakdown.length > 0 && (
          <ChartCard title={t("locationDistribution")}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.location_breakdown as any[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="location_name" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="total_quantity"
                  name={t("totalQuantity")}
                  fill="#8b5cf6"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Top Borrowers */}
      {data.top_borrowers.length > 0 && (
        <div className="bg-card p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t("topBorrowers")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">{t("borrowerName")}</th>
                  <th className="text-right py-2 px-4">{t("activeLoans")}</th>
                  <th className="text-right py-2 px-4">{t("totalLoans")}</th>
                </tr>
              </thead>
              <tbody>
                {data.top_borrowers.map((borrower) => (
                  <tr
                    key={borrower.borrower_id}
                    className="border-b hover:bg-muted/50"
                  >
                    <td className="py-2 px-4">{borrower.borrower_name}</td>
                    <td className="text-right py-2 px-4">
                      {borrower.active_loans}
                    </td>
                    <td className="text-right py-2 px-4">
                      {borrower.total_loans}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {data.total_items === 0 &&
        data.total_inventory_records === 0 &&
        data.total_locations === 0 && (
          <div className="bg-card p-8 rounded-lg border text-center">
            <FolderTree className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("noData")}</h3>
            <p className="text-muted-foreground">{t("noDataDescription")}</p>
          </div>
        )}
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card p-6 rounded-lg border shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <Icon className="w-8 h-8 text-primary" />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card p-6 rounded-lg border">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function RetroStatCard({
  iconName,
  label,
  value,
}: {
  iconName: "Package" | "Boxes" | "MapPin" | "DollarSign";
  label: string;
  value: string;
}) {
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

function RetroChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card p-6 border-4 border-border retro-shadow">
      <h3 className="text-sm font-bold uppercase retro-heading mb-4">{title}</h3>
      {children}
    </div>
  );
}
