"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDateFormat } from "@/lib/hooks/use-date-format";
import {
  Download,
  CheckCircle,
  Package,
  Eye,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeclutterFilters } from "@/components/declutter/declutter-filters";
import { DeclutterScoreBadge } from "@/components/declutter/declutter-score-badge";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { declutterApi } from "@/lib/api";
import type { DeclutterItem, DeclutterCounts, DeclutterGroupBy } from "@/lib/types/declutter";
import { exportToCSV, generateFilename, type ColumnDefinition } from "@/lib/utils/csv-export";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

/**
 * Format currency from cents to display string
 */
function formatCurrency(amountCents: number | null | undefined, currencyCode: string | null | undefined): string {
  if (amountCents === null || amountCents === undefined) return "-";
  const amount = amountCents / 100;
  const currency = currencyCode || "EUR";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export default function DeclutterPage() {
  const t = useTranslations("declutter");
  const { workspace, workspaceId } = useWorkspace();
  const { formatDate } = useDateFormat();

  // State
  const [items, setItems] = useState<DeclutterItem[]>([]);
  const [counts, setCounts] = useState<DeclutterCounts | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [thresholdDays, setThresholdDays] = useState(90);
  const [groupBy, setGroupBy] = useState<DeclutterGroupBy>("");
  const [markingUsed, setMarkingUsed] = useState<string | null>(null);

  // Fetch items
  const fetchItems = useCallback(async (reset = false) => {
    if (!workspaceId) return;

    const currentPage = reset ? 1 : page;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await declutterApi.listUnused(workspaceId, {
        threshold_days: thresholdDays,
        group_by: groupBy,
        page: currentPage,
        limit: PAGE_SIZE,
      });

      if (reset) {
        setItems(response.items);
        setPage(1);
      } else {
        setItems((prev) => [...prev, ...response.items]);
      }
      setTotal(response.total);
    } catch (error) {
      console.error("Failed to fetch declutter items:", error);
      toast.error("Failed to load unused items");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [workspaceId, thresholdDays, groupBy, page]);

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const response = await declutterApi.getCounts(workspaceId);
      setCounts(response);
    } catch (error) {
      console.error("Failed to fetch counts:", error);
    }
  }, [workspaceId]);

  // Initial load and reload on filter changes
  useEffect(() => {
    if (workspaceId) {
      fetchItems(true);
      fetchCounts();
    }
  }, [workspaceId, thresholdDays, groupBy]);

  // Handle filter changes
  const handleThresholdChange = (days: number) => {
    setThresholdDays(days);
    setPage(1);
  };

  const handleGroupByChange = (value: DeclutterGroupBy) => {
    setGroupBy(value);
    setPage(1);
  };

  // Handle mark as used
  const handleMarkUsed = async (item: DeclutterItem) => {
    if (!workspaceId) return;

    setMarkingUsed(item.id);
    try {
      await declutterApi.markAsUsed(workspaceId, item.id);
      // Remove item from list
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setTotal((prev) => prev - 1);
      toast.success(t("toast.markedUsed"));
      // Refresh counts
      fetchCounts();
    } catch (error) {
      console.error("Failed to mark as used:", error);
      toast.error("Failed to mark item as used");
    } finally {
      setMarkingUsed(null);
    }
  };

  // Handle export
  const handleExport = () => {
    const columns: ColumnDefinition<DeclutterItem>[] = [
      { key: "item_name", label: t("table.item") },
      { key: "item_sku", label: "SKU" },
      { key: "location_name", label: t("table.location") },
      { key: "category_name", label: t("table.category") },
      { key: "days_unused", label: t("table.daysUnused") },
      { key: "score", label: t("table.score") },
      { key: "quantity", label: "Quantity" },
      {
        key: "purchase_price",
        label: t("table.value"),
        formatter: (value) => value ? (value / 100).toFixed(2) : "",
      },
      { key: "currency_code", label: "Currency" },
      { key: "condition", label: "Condition" },
      { key: "status", label: "Status" },
      {
        key: "last_used_at",
        label: "Last Used",
        formatter: (value) => value ? formatDate(value) : "Never",
      },
    ];

    exportToCSV(items, columns, generateFilename("declutter"));
    toast.success(t("toast.exportSuccess"));
  };

  // Load more
  const handleLoadMore = () => {
    if (loadingMore || items.length >= total) return;
    setPage((prev) => prev + 1);
  };

  // Trigger fetch when page changes (for load more)
  useEffect(() => {
    if (page > 1 && workspaceId) {
      fetchItems(false);
    }
  }, [page]);

  // Get current count based on threshold
  const currentCount = counts
    ? thresholdDays === 90
      ? counts.unused_90
      : thresholdDays === 180
      ? counts.unused_180
      : counts.unused_365
    : 0;

  const currentValue = counts
    ? thresholdDays === 90
      ? counts.value_90
      : thresholdDays === 180
      ? counts.value_180
      : counts.value_365
    : 0;

  // Group items if groupBy is set
  const groupedItems = useMemo(() => {
    if (!groupBy) return { "": items };

    const groups: Record<string, DeclutterItem[]> = {};
    items.forEach((item) => {
      const key = groupBy === "category"
        ? item.category_name || "Uncategorized"
        : item.location_name;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [items, groupBy]);

  if (loading) {
    return (
      <div className="container py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>

        <Button onClick={handleExport} disabled={items.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          {t("actions.export")}
        </Button>
      </div>

      {/* Summary Card */}
      {counts && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-2xl font-bold">{currentCount}</div>
                <div className="text-sm text-muted-foreground">
                  {t("summary.items")}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {formatCurrency(currentValue, "EUR")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("summary.totalValue")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <DeclutterFilters
        thresholdDays={thresholdDays}
        groupBy={groupBy}
        onThresholdChange={handleThresholdChange}
        onGroupByChange={handleGroupByChange}
      />

      {/* Content */}
      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("emptyState.title")}
          description={t("emptyState.description")}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([groupName, groupItems]) => (
            <Card key={groupName || "all"}>
              {groupBy && groupName && (
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{groupName}</CardTitle>
                  <CardDescription>
                    {groupItems.length} {t("summary.items")}
                  </CardDescription>
                </CardHeader>
              )}
              <CardContent className={cn(!groupBy && "pt-6")}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.item")}</TableHead>
                      <TableHead>{t("table.location")}</TableHead>
                      {!groupBy && <TableHead>{t("table.category")}</TableHead>}
                      <TableHead className="text-right">{t("table.daysUnused")}</TableHead>
                      <TableHead className="text-right">{t("table.value")}</TableHead>
                      <TableHead className="text-center">{t("table.score")}</TableHead>
                      <TableHead className="text-right">{t("table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.item_name}</div>
                            {item.item_sku && (
                              <div className="text-sm text-muted-foreground">
                                {item.item_sku}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.location_name}</TableCell>
                        {!groupBy && (
                          <TableCell>{item.category_name || "-"}</TableCell>
                        )}
                        <TableCell className="text-right">
                          {item.days_unused}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.purchase_price
                            ? formatCurrency(item.purchase_price, item.currency_code)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <DeclutterScoreBadge score={item.score} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                ...
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleMarkUsed(item)}
                                disabled={markingUsed === item.id}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                {t("actions.markUsed")}
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/inventory?item=${item.item_id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  {t("actions.viewItem")}
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {/* Load more */}
          {items.length < total && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : `Load more (${items.length}/${total})`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
