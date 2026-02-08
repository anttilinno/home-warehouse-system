"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  History,
  Package,
  MapPin,
  Box,
  FolderTree,
  Users,
  HandCoins,
  Archive,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useDateFormat } from "@/lib/hooks/use-date-format";
import { getFilteredConflicts } from "@/lib/sync/conflict-resolver";
import type { ConflictLogEntry, MutationEntityType, ConflictResolution } from "@/lib/db/types";

// Entity type icons (same as approvals page)
const entityTypeIcons: Record<MutationEntityType, typeof Package> = {
  items: Package,
  inventory: Archive,
  locations: MapPin,
  containers: Box,
  categories: FolderTree,
  borrowers: Users,
  loans: HandCoins,
};

// Resolution badge colors
function getResolutionColor(resolution: ConflictResolution): string {
  switch (resolution) {
    case "local":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "server":
      return "bg-green-500/10 text-green-700 border-green-500/20";
    case "merged":
      return "bg-purple-500/10 text-purple-700 border-purple-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
}

// Format field names for display
function formatFieldName(fieldName: string): string {
  return fieldName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface ConflictCardProps {
  conflict: ConflictLogEntry;
  t: ReturnType<typeof useTranslations>;
}

function ConflictCard({ conflict, t }: ConflictCardProps) {
  const Icon = entityTypeIcons[conflict.entityType];
  const entityTypeKey = conflict.entityType === "items" ? "items" : conflict.entityType;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {t(`filter.${entityTypeKey}`)}
                  </Badge>
                  <Badge variant="outline" className={getResolutionColor(conflict.resolution)}>
                    {t(`resolution.${conflict.resolution}`)}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {t("card.entityId")}: <span className="font-mono text-foreground">{conflict.entityId.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            {/* Conflict fields */}
            {conflict.conflictFields.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {t("card.conflictFields")}: <span className="text-foreground">{conflict.conflictFields.map(formatFieldName).join(", ")}</span>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {t("card.detected")}: {formatDistanceToNow(new Date(conflict.timestamp), { addSuffix: true })}
              </span>
              {conflict.resolvedAt && (
                <span>
                  {t("card.resolved")}: {formatDistanceToNow(new Date(conflict.resolvedAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConflictListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/4 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function SyncHistoryPage() {
  const t = useTranslations("syncHistory");
  const { placeholder: datePlaceholder } = useDateFormat();

  const [conflicts, setConflicts] = useState<ConflictLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [entityTypeFilter, setEntityTypeFilter] = useState<MutationEntityType | "all">("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const loadConflicts = useCallback(async () => {
    // Check if IndexedDB is available (client-side only)
    if (typeof indexedDB === "undefined") {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const filters: {
        entityType?: MutationEntityType;
        fromDate?: number;
        toDate?: number;
      } = {};

      if (entityTypeFilter !== "all") {
        filters.entityType = entityTypeFilter;
      }

      if (fromDate) {
        // Start of day in local timezone
        filters.fromDate = new Date(fromDate).getTime();
      }

      if (toDate) {
        // End of day in local timezone (23:59:59.999)
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        filters.toDate = endDate.getTime();
      }

      const result = await getFilteredConflicts(filters, 100);
      setConflicts(result);
    } catch (error) {
      console.error("Failed to load conflict log:", error);
    } finally {
      setIsLoading(false);
    }
  }, [entityTypeFilter, fromDate, toDate]);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const handleClearDates = () => {
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Entity type filter */}
        <Select
          value={entityTypeFilter}
          onValueChange={(v) => setEntityTypeFilter(v as MutationEntityType | "all")}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.allTypes")}</SelectItem>
            <SelectItem value="items">{t("filter.items")}</SelectItem>
            <SelectItem value="inventory">{t("filter.inventory")}</SelectItem>
            <SelectItem value="locations">{t("filter.locations")}</SelectItem>
            <SelectItem value="containers">{t("filter.containers")}</SelectItem>
            <SelectItem value="categories">{t("filter.categories")}</SelectItem>
            <SelectItem value="borrowers">{t("filter.borrowers")}</SelectItem>
            <SelectItem value="loans">{t("filter.loans")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="from-date" className="text-sm text-muted-foreground whitespace-nowrap">
              {t("dateRange.from")} <span className="text-xs font-normal">({datePlaceholder})</span>
            </Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="to-date" className="text-sm text-muted-foreground whitespace-nowrap">
              {t("dateRange.to")} <span className="text-xs font-normal">({datePlaceholder})</span>
            </Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[150px]"
            />
          </div>
          {(fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearDates}
              className="h-8 px-2"
            >
              <X className="h-4 w-4 mr-1" />
              {t("dateRange.clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Conflict list */}
      {isLoading ? (
        <ConflictListSkeleton />
      ) : conflicts.length === 0 ? (
        <EmptyState
          icon={History}
          title={t("empty")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="space-y-4">
          {conflicts.map((conflict) => (
            <ConflictCard key={conflict.id} conflict={conflict} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
