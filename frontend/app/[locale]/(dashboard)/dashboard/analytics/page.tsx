"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Package,
  MapPin,
  Box,
  Users,
  TrendingUp,
  AlertTriangle,
  HandCoins,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { analyticsApi } from "@/lib/api";
import type {
  DashboardStats,
  LoanStats,
  CategoryStats,
  LocationInventoryValue,
  ConditionBreakdown,
  StatusBreakdown,
  TopBorrower,
  MonthlyLoanActivity,
} from "@/lib/api/analytics";

const COLORS = {
  primary: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#a855f7",
  teal: "#14b8a6",
  pink: "#ec4899",
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.purple,
  COLORS.teal,
  COLORS.pink,
];

function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "text-foreground",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && <p className="text-xs text-muted-foreground">{trend}</p>}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-[100px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-[150px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loanStats, setLoanStats] = useState<LoanStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [locationValues, setLocationValues] = useState<LocationInventoryValue[]>([]);
  const [conditionBreakdown, setConditionBreakdown] = useState<ConditionBreakdown[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [topBorrowers, setTopBorrowers] = useState<TopBorrower[]>([]);
  const [monthlyActivity, setMonthlyActivity] = useState<MonthlyLoanActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      if (!workspaceId) return;

      try {
        setIsLoading(true);

        // Load all analytics data in parallel
        const [
          dashboard,
          loans,
          categories,
          locations,
          conditions,
          statuses,
          borrowers,
          activity,
        ] = await Promise.all([
          analyticsApi.getDashboardStats(workspaceId),
          analyticsApi.getLoanStats(workspaceId),
          analyticsApi.getCategoryStats(workspaceId, 10),
          analyticsApi.getLocationValues(workspaceId, 10),
          analyticsApi.getConditionBreakdown(workspaceId),
          analyticsApi.getStatusBreakdown(workspaceId),
          analyticsApi.getTopBorrowers(workspaceId, 10),
          analyticsApi.getMonthlyLoanActivity(workspaceId, 12),
        ]);

        setDashboardStats(dashboard);
        setLoanStats(loans);
        setCategoryStats(categories);
        setLocationValues(locations);
        setConditionBreakdown(conditions);
        setStatusBreakdown(statuses);
        setTopBorrowers(borrowers);
        setMonthlyActivity(activity);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load analytics";
        toast.error("Failed to load analytics", {
          description: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadAnalytics();
  }, [workspaceId]);

  if (workspaceLoading || isLoading) {
    return <LoadingSkeleton />;
  }

  if (!dashboardStats) {
    return <div>No data available</div>;
  }

  // Format monthly activity data for chart
  const monthlyActivityData = monthlyActivity.map((item) => ({
    month: new Date(item.month).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    created: item.loans_created,
    returned: item.loans_returned,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive insights into your inventory and loan activity
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Items"
          value={dashboardStats.total_items}
          icon={Package}
          color="text-blue-500"
        />
        <StatsCard
          title="Total Inventory"
          value={dashboardStats.total_inventory}
          icon={Box}
          color="text-green-500"
        />
        <StatsCard
          title="Active Loans"
          value={dashboardStats.active_loans}
          icon={HandCoins}
          color="text-purple-500"
        />
        <StatsCard
          title="Overdue Loans"
          value={dashboardStats.overdue_loans}
          icon={AlertTriangle}
          color="text-red-500"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Locations"
          value={dashboardStats.total_locations}
          icon={MapPin}
          color="text-teal-500"
        />
        <StatsCard
          title="Containers"
          value={dashboardStats.total_containers}
          icon={Box}
          color="text-orange-500"
        />
        <StatsCard
          title="Borrowers"
          value={dashboardStats.total_borrowers}
          icon={Users}
          color="text-pink-500"
        />
        <StatsCard
          title="Low Stock Items"
          value={dashboardStats.low_stock_items}
          icon={TrendingUp}
          color="text-yellow-500"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Items by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Items by Category</CardTitle>
            <CardDescription>Top 10 categories by item count</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="item_count" fill={COLORS.primary} name="Items" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Inventory by Condition */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory by Condition</CardTitle>
            <CardDescription>Distribution of inventory conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={conditionBreakdown as any}
                  dataKey="count"
                  nameKey="condition"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {conditionBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Inventory by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory by Status</CardTitle>
            <CardDescription>Current status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusBreakdown} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="status" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS.success} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Loan Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Activity (12 Months)</CardTitle>
            <CardDescription>Loans created vs returned</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyActivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke={COLORS.primary} name="Created" />
                <Line type="monotone" dataKey="returned" stroke={COLORS.success} name="Returned" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Borrowers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Borrowers</CardTitle>
            <CardDescription>Most active borrowers</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Total Loans</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBorrowers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No borrowers yet
                    </TableCell>
                  </TableRow>
                ) : (
                  topBorrowers.map((borrower) => (
                    <TableRow key={borrower.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{borrower.name}</div>
                          {borrower.email && (
                            <div className="text-sm text-muted-foreground">{borrower.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{borrower.total_loans}</TableCell>
                      <TableCell>
                        <Badge variant={borrower.active_loans > 0 ? "default" : "secondary"}>
                          {borrower.active_loans}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Location Values */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Value by Location</CardTitle>
            <CardDescription>Top locations by inventory value</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locationValues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No locations yet
                    </TableCell>
                  </TableRow>
                ) : (
                  locationValues.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell>{location.item_count}</TableCell>
                      <TableCell>{location.total_quantity}</TableCell>
                      <TableCell className="text-right">
                        ${(location.total_value / 100).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Loan Stats Summary */}
      {loanStats && (
        <Card>
          <CardHeader>
            <CardTitle>Loan Summary</CardTitle>
            <CardDescription>Overall loan statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Loans</p>
                <p className="text-2xl font-bold">{loanStats.total_loans}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-blue-500">{loanStats.active_loans}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Returned</p>
                <p className="text-2xl font-bold text-green-500">{loanStats.returned_loans}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-500">{loanStats.overdue_loans}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
