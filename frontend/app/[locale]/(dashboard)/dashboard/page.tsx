import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import {
  Package,
  MapPin,
  Box,
  AlertTriangle,
  HandCoins,
  TrendingUp,
  Clock,
  CheckCircle,
} from "lucide-react";

import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });

  return {
    title: t("title"),
  };
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "dashboard" });

  // TODO: Fetch actual data from API
  const stats = {
    totalItems: 1247,
    locations: 24,
    containers: 56,
    activeLoans: 8,
    lowStockItems: 12,
    expiringItems: 5,
  };

  const recentActivity = [
    { id: 1, type: "add", item: "Power Drill", location: "Garage > Tools", time: "2 hours ago" },
    { id: 2, type: "move", item: "Winter Clothes", location: "Storage > Seasonal", time: "5 hours ago" },
    { id: 3, type: "loan", item: "Camping Tent", borrower: "John Smith", time: "1 day ago" },
    { id: 4, type: "return", item: "Ladder", borrower: "Jane Doe", time: "2 days ago" },
  ];

  const alerts = [
    { id: 1, type: "low_stock", message: t("alerts.lowStock", { count: stats.lowStockItems }), severity: "warning" },
    { id: 2, type: "expiring", message: t("alerts.expiring", { count: stats.expiringItems }), severity: "warning" },
    { id: 3, type: "overdue", message: t("alerts.overdueLoans", { count: 2 }), severity: "error" },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t("stats.totalItems")}
          value={stats.totalItems.toLocaleString()}
          icon={Package}
          trend={{ value: 12, positive: true }}
        />
        <StatsCard
          title={t("stats.locations")}
          value={stats.locations}
          icon={MapPin}
        />
        <StatsCard
          title={t("stats.containers")}
          value={stats.containers}
          icon={Box}
        />
        <StatsCard
          title={t("stats.activeLoans")}
          value={stats.activeLoans}
          icon={HandCoins}
          description={t("stats.activeLoansDesc")}
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
                      {activity.location || activity.borrower}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
