import { useEffect, useState, useCallback } from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel } from "@/components/retro";
import { get } from "@/lib/api";
import type { RecentActivity } from "@/lib/types";

function formatActivityLine(entry: RecentActivity): string {
  const time = new Date(entry.created_at).toLocaleTimeString("default", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const action = entry.action.toUpperCase();
  if (entry.entity_name) {
    return `[${time}] ${action} ${entry.entity_type}: ${entry.entity_name}`;
  }
  return `[${time}] ${action} ${entry.entity_type}`;
}

interface ActivityFeedProps {
  workspaceId: string;
}

export function ActivityFeed({ workspaceId }: ActivityFeedProps) {
  const { t } = useLingui();
  const [entries, setEntries] = useState<RecentActivity[]>([]);

  const fetchActivity = useCallback(async () => {
    try {
      const data = await get<RecentActivity[]>(
        `/workspaces/${workspaceId}/analytics/activity?limit=10`
      );
      setEntries(data);
    } catch {
      // Silent fail per D-07 -- feed stays as-is
    }
  }, [workspaceId]);

  // Initial fetch (per D-07)
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // SSE connection scoped to dashboard (per D-08)
  useEffect(() => {
    const es = new EventSource(`/api/workspaces/${workspaceId}/sse`, {
      withCredentials: true,
    });
    es.onmessage = () => {
      fetchActivity();
    };
    es.onerror = () => {
      // Silent fail per D-08 -- feed stays static
    };
    return () => es.close();
  }, [workspaceId, fetchActivity]);

  return (
    <section aria-label={t`Activity log`}>
      <RetroPanel
        showHazardStripe
        className="!bg-retro-charcoal !text-retro-cream"
      >
        <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-md">
          {t`ACTIVITY LOG`}
        </h2>
        <div className="font-mono text-[14px] leading-tight space-y-xs">
          {entries.length === 0 ? (
            <span className="text-retro-gray" role="status">
              {">"} {t`NO ACTIVITY YET`}
            </span>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="text-retro-cream">
                {formatActivityLine(e)}
              </div>
            ))
          )}
        </div>
      </RetroPanel>
    </section>
  );
}
