"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { PackageX, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { analyticsApi, type OutOfStockItem } from "@/lib/api";
import { Link } from "@/i18n/navigation";

function OutOfStockListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OutOfStockPage() {
  const t = useTranslations("outOfStock");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [items, setItems] = useState<OutOfStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadItems = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      const data = await analyticsApi.getOutOfStockItems(workspaceId);
      setItems(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load items";
      toast.error("Failed to load out of stock items", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      loadItems();
    }
  }, [workspaceId, loadItems]);

  // Filter items by search
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  if (workspaceLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("search")}
            className="pl-8"
            disabled
          />
        </div>

        <OutOfStockListSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("search")}
          className="pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5 text-destructive" />
            {t("title")}
          </CardTitle>
          <CardDescription>
            {items.length > 0
              ? t("count", { count: items.length })
              : t("emptyDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            searchQuery ? (
              <EmptyState
                icon={PackageX}
                title={t("noResults")}
                description={t("search")}
              />
            ) : (
              <EmptyState
                icon={PackageX}
                title={t("empty")}
                description={t("emptyDescription")}
              />
            )
          ) : (
            <div className="divide-y">
              {/* Table header */}
              <div className="hidden sm:grid sm:grid-cols-12 gap-4 py-3 text-sm font-medium text-muted-foreground">
                <div className="col-span-4">{t("name")}</div>
                <div className="col-span-2">{t("sku")}</div>
                <div className="col-span-3">{t("category")}</div>
                <div className="col-span-2">{t("minStock")}</div>
                <div className="col-span-1"></div>
              </div>

              {/* Items */}
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 py-4 items-center"
                >
                  {/* Name */}
                  <div className="sm:col-span-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                      <PackageX className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-sm text-muted-foreground sm:hidden">
                        {item.sku}
                      </div>
                    </div>
                  </div>

                  {/* SKU */}
                  <div className="hidden sm:block sm:col-span-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {item.sku}
                    </code>
                  </div>

                  {/* Category */}
                  <div className="sm:col-span-3">
                    <Badge variant="outline">
                      {item.category_name || t("uncategorized")}
                    </Badge>
                  </div>

                  {/* Min Stock */}
                  <div className="sm:col-span-2">
                    <span className="text-sm text-muted-foreground">
                      {item.min_stock_level > 0 ? item.min_stock_level : "-"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="sm:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <Link href={`/dashboard/items/${item.id}`}>
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">{t("viewItem")}</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
