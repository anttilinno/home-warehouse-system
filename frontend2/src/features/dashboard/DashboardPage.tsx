import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "@/features/auth/AuthContext";
import { get } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { StatPanel } from "./StatPanel";
import { ActivityFeed } from "./ActivityFeed";
import { QuickActionCards } from "./QuickActionCards";

export function DashboardPage() {
  const { t } = useLingui();
  const { workspaceId, isLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Redirect to setup if no workspace (per D-02)
  useEffect(() => {
    if (!isLoading && !workspaceId) {
      navigate("/setup", { replace: true });
    }
  }, [isLoading, workspaceId, navigate]);

  // Fetch stats once on mount (per D-05)
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    get<DashboardStats>(`/workspaces/${workspaceId}/analytics/dashboard`)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        // Silent fail -- stats remain null (shows "---")
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (isLoading) return null;
  if (!workspaceId) return null;

  return (
    <div className="p-lg flex flex-col gap-xl">
      {/* Stats row -- per D-03: 3 panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
        <StatPanel label={t`ITEMS`} value={stats?.total_items ?? null} />
        <StatPanel
          label={t`CATEGORIES`}
          value={stats?.total_categories ?? null}
        />
        <StatPanel
          label={t`LOCATIONS`}
          value={stats?.total_locations ?? null}
        />
      </div>

      {/* Activity feed -- per D-06, D-07, D-08 */}
      <ActivityFeed workspaceId={workspaceId} />

      {/* Quick actions -- per D-09 */}
      <QuickActionCards />
    </div>
  );
}
