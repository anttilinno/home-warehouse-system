"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CalendarClock, ShieldAlert } from "lucide-react";

import { inventoryApi } from "@/lib/api";
import type { ExpiringInventory } from "@/lib/types/inventory";
import { useDateFormat } from "@/lib/hooks/use-date-format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_ENTRIES = 5;

interface ExpiringSoonCardProps {
  workspaceId: string;
  /** Window in days (default 30, matching the reminder job). */
  days?: number;
}

/**
 * Dashboard widget listing inventory whose expiration date or warranty end
 * falls within the next `days` days.
 */
export function ExpiringSoonCard({ workspaceId, days = 30 }: ExpiringSoonCardProps) {
  const t = useTranslations("dashboard.expiringSoon");
  const { formatDate } = useDateFormat();
  const [entries, setEntries] = useState<ExpiringInventory[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await inventoryApi.listExpiring(workspaceId, days);
      setEntries(data.items.slice(0, MAX_ENTRIES));
      setTotal(data.total);
    } catch {
      // Non-critical widget: fail quietly, dashboard stays usable.
      setEntries([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card data-testid="expiring-soon-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-500" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description", { days })}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("empty")}</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Link
                key={`${entry.inventory_id}-${entry.kind}`}
                href={`/dashboard/items/${entry.item_id}`}
                className="flex items-center justify-between gap-2 rounded-xl border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{entry.item_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 gap-1">
                  {entry.kind === "warranty" ? (
                    <ShieldAlert className="h-3 w-3" />
                  ) : (
                    <CalendarClock className="h-3 w-3" />
                  )}
                  {entry.kind === "warranty" ? t("warranty") : t("expires")}
                </Badge>
              </Link>
            ))}
            {total > entries.length && (
              <p className="text-xs text-muted-foreground text-center">
                {t("more", { count: total - entries.length })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
