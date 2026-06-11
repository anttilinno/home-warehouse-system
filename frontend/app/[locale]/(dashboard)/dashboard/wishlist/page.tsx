"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Plus,
  Heart,
  ExternalLink,
  PackageCheck,
  ShoppingCart,
  Undo2,
  Pencil,
  Trash2,
  MoreHorizontal,
} from "lucide-react";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useNumberFormat } from "@/lib/hooks/use-number-format";
import { wishlistApi } from "@/lib/api";
import type { WishlistItem, WishlistStatus } from "@/lib/types/wishlist";
import { cn } from "@/lib/utils";
import { WishlistItemDialog } from "@/components/wishlist/wishlist-item-dialog";

const PAGE_SIZE = 50;

type StatusFilter = WishlistStatus | "all";

const STATUS_FILTERS: StatusFilter[] = ["all", "wanted", "ordered", "acquired"];

export default function WishlistPage() {
  const t = useTranslations("wishlist");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspaceId } = useWorkspace();
  const { formatNumber } = useNumberFormat();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mutating, setMutating] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WishlistItem | null>(null);

  // ?add=1 (FAB quick action) opens the add dialog directly
  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setEditing(null);
      setDialogOpen(true);
    }
  }, [searchParams]);

  const formatPrice = useCallback(
    (cents: number | null | undefined, currencyCode: string | null | undefined): string => {
      if (cents === null || cents === undefined) return "-";
      const amount = cents / 100;
      const currency = currencyCode || "EUR";
      const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency + " ";
      return `${symbol}${formatNumber(amount, 2)}`;
    },
    [formatNumber]
  );

  const fetchItems = useCallback(
    async (reset = false) => {
      if (!workspaceId) return;

      const currentPage = reset ? 1 : page;
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await wishlistApi.list(workspaceId, {
          status: statusFilter === "all" ? undefined : statusFilter,
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
        console.error("Failed to fetch wishlist:", error);
        toast.error(t("toasts.loadFailed"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [workspaceId, statusFilter, page, t]
  );

  // Initial load and reload on filter changes
  useEffect(() => {
    if (workspaceId) {
      fetchItems(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, statusFilter]);

  // Trigger fetch when page changes (for load more)
  useEffect(() => {
    if (page > 1 && workspaceId) {
      fetchItems(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleStatusChange = async (item: WishlistItem, status: WishlistStatus) => {
    if (!workspaceId) return;

    setMutating(item.id);
    try {
      await wishlistApi.update(workspaceId, item.id, { status });
      toast.success(t(`toasts.${status}`));
      fetchItems(true);
    } catch (error) {
      console.error("Failed to update wishlist item:", error);
      toast.error(t("toasts.updateFailed"));
    } finally {
      setMutating(null);
    }
  };

  // The acquire flow: redirect to the item create wizard prefilled from the
  // wishlist row. After the item is created the wizard PATCHes the row with
  // acquired_item_id (status -> acquired), closing it.
  const handleAcquire = (item: WishlistItem) => {
    const params = new URLSearchParams();
    params.set("name", item.name);
    if (item.desired_category_id) params.set("category_id", item.desired_category_id);

    // Notes + URL + price estimate land in the item description (the create
    // wizard has no inventory-level purchase_price field).
    const descriptionParts: string[] = [];
    if (item.notes) descriptionParts.push(item.notes);
    if (item.url) descriptionParts.push(item.url);
    if (item.price_estimate !== null && item.price_estimate !== undefined) {
      descriptionParts.push(
        `${t("acquire.estimatedPrice")}: ${formatPrice(item.price_estimate, item.currency_code)}`
      );
    }
    if (descriptionParts.length > 0) params.set("description", descriptionParts.join("\n"));

    params.set("wishlist_id", item.id);
    router.push(`/dashboard/items/new?${params.toString()}`);
  };

  const handleDelete = async (item: WishlistItem) => {
    if (!workspaceId) return;

    setMutating(item.id);
    try {
      await wishlistApi.delete(workspaceId, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setTotal((prev) => prev - 1);
      toast.success(t("toasts.deleted"));
    } catch (error) {
      console.error("Failed to delete wishlist item:", error);
      toast.error(t("toasts.deleteFailed"));
    } finally {
      setMutating(null);
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || items.length >= total) return;
    setPage((prev) => prev + 1);
  };

  const openCreateDialog = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEditDialog = (item: WishlistItem) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const priorityVariant = (priority: number) =>
    priority <= 2 ? "destructive" : priority === 3 ? "secondary" : "outline";

  const statusBadge = (status: WishlistStatus) => (
    <Badge
      variant="outline"
      className={cn(
        status === "wanted" && "border-blue-400/40 text-blue-700 dark:text-blue-300",
        status === "ordered" && "border-orange-400/40 text-orange-700 dark:text-orange-300",
        status === "acquired" && "border-green-400/40 text-green-700 dark:text-green-300"
      )}
    >
      {t(`status.${status}`)}
    </Badge>
  );

  if (loading) {
    return (
      <div className="container py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
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

        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("actions.add")}
        </Button>
      </div>

      {/* Status filter */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList>
          {STATUS_FILTERS.map((status) => (
            <TabsTrigger key={status} value={status}>
              {status === "all" ? t("filter.all") : t(`status.${status}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content */}
      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("emptyState.title")}
          description={t("emptyState.description")}
          action={{ label: t("actions.add"), onClick: openCreateDialog }}
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.name")}</TableHead>
                    <TableHead className="text-center">{t("table.priority")}</TableHead>
                    <TableHead className="text-right">{t("table.price")}</TableHead>
                    <TableHead className="text-center">{t("table.status")}</TableHead>
                    <TableHead className="text-right">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {item.name}
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={t("table.openUrl")}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          {item.notes && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={priorityVariant(item.priority)}>
                          P{item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(item.price_estimate, item.currency_code)}
                      </TableCell>
                      <TableCell className="text-center">{statusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={mutating === item.id}
                              aria-label={t("table.actions")}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.status !== "acquired" && (
                              <DropdownMenuItem onClick={() => handleAcquire(item)}>
                                <PackageCheck className="mr-2 h-4 w-4" />
                                {t("actions.markAcquired")}
                              </DropdownMenuItem>
                            )}
                            {item.status === "wanted" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(item, "ordered")}
                              >
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                {t("actions.markOrdered")}
                              </DropdownMenuItem>
                            )}
                            {item.status === "ordered" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(item, "wanted")}
                              >
                                <Undo2 className="mr-2 h-4 w-4" />
                                {t("actions.backToWanted")}
                              </DropdownMenuItem>
                            )}
                            {item.status !== "acquired" && (
                              <DropdownMenuItem onClick={() => openEditDialog(item)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {t("actions.edit")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(item)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("actions.delete")}
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

          {/* Load more */}
          {items.length < total && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore
                  ? t("loadingMore")
                  : t("loadMore", { shown: items.length, total })}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Create/edit dialog */}
      <WishlistItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        onSaved={() => fetchItems(true)}
      />
    </div>
  );
}
