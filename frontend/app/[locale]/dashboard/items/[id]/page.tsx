"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import {
  itemsApi,
  categoriesApi,
  inventoryApi,
  locationsApi,
  Item,
  Category,
  Inventory,
  Location,
} from "@/lib/api";
import { Icon } from "@/components/icons";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { LinkedDocuments } from "@/components/docspell";
import { formatDateTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED } from "@/lib/nes-colors";
import { useThemed, useThemedClasses } from "@/lib/themed";

export default function ItemDetailPage() {
  const { isAuthenticated, isLoading: authLoading, user, canEdit } = useAuth();
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;
  const t = useTranslations("items");
  const themed = useThemed();
  const classes = useThemedClasses();

  const { Button, Card, PageHeader } = themed;

  // Data state
  const [item, setItem] = useState<Item | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lookup maps
  const categoryMap = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories]
  );

  const locationMap = useMemo(
    () => new Map(locations.map((loc) => [loc.id, loc])),
    [locations]
  );

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categoryMap.get(categoryId)?.name || null;
  };

  const getLocationName = (locationId: string) => {
    return locationMap.get(locationId)?.name || "Unknown";
  };

  // Get inventory for this item
  const itemInventory = useMemo(
    () => inventory.filter((inv) => inv.item_id === itemId),
    [inventory, itemId]
  );

  const totalQuantity = useMemo(
    () => itemInventory.reduce((sum, inv) => sum + inv.quantity, 0),
    [itemInventory]
  );

  useEffect(() => {
    if (isAuthenticated && itemId) {
      fetchData();
    }
  }, [isAuthenticated, itemId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemData, categoriesData, inventoryData, locationsData] = await Promise.all([
        itemsApi.get(itemId),
        categoriesApi.list(),
        inventoryApi.list(),
        locationsApi.list(),
      ]);
      setItem(itemData);
      setCategories(categoriesData);
      setInventory(inventoryData);
      setLocations(locationsData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load item";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        classes.isRetro && "retro-body"
      )}>
        <div className={classes.loadingText}>{t("loading")}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error || !item) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        classes.isRetro && "retro-body"
      )}>
        <div className="text-center">
          <p
            className={cn(
              "mb-4",
              classes.isRetro ? "retro-small uppercase" : "text-red-500"
            )}
            style={classes.isRetro ? { color: NES_RED } : undefined}
          >
            {error || t("itemNotFound")}
          </p>
          <Button
            variant="primary"
            onClick={() => router.push("/dashboard/items")}
          >
            {t("backToList")}
          </Button>
        </div>
      </div>
    );
  }

  const categoryName = getCategoryName(item.category_id);

  return (
    <div className="w-full">
      {/* Header */}
      <div className={classes.isRetro ? "mb-8" : "mb-8"}>
        <button
          onClick={() => router.push("/dashboard/items")}
          className={cn(
            "flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors",
            classes.isRetro && "retro-body retro-small uppercase"
          )}
        >
          <Icon name="ArrowLeft" className="w-4 h-4" />
          {t("backToList")}
        </button>
        <PageHeader
          title={item.name}
          subtitle={item.sku}
          actions={
            <div className="flex items-center gap-2">
              <FavoriteButton
                entityType="ITEM"
                entityId={item.id}
                size="lg"
              />
              {canEdit && (
                <Button
                  variant="primary"
                  icon="Pencil"
                  onClick={() => router.push(`/dashboard/items?edit=${item.id}`)}
                >
                  {t("edit")}
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card icon="Tag" title={t("basicInfo")} padding="lg">
            {item.description && (
              <p className={cn(
                "text-muted-foreground mb-4",
                classes.isRetro && "retro-body"
              )}>
                {item.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              {categoryName && (
                <div>
                  <span className={cn(
                    "text-muted-foreground",
                    classes.isRetro ? "retro-small uppercase" : "text-sm"
                  )}>
                    {t("category")}
                  </span>
                  <p className={cn(classes.isRetro ? "retro-body" : "font-medium")}>
                    {categoryName}
                  </p>
                </div>
              )}
              {item.brand && (
                <div>
                  <span className={cn(
                    "text-muted-foreground",
                    classes.isRetro ? "retro-small uppercase" : "text-sm"
                  )}>
                    {t("brand")}
                  </span>
                  <p className={cn(classes.isRetro ? "retro-body" : "font-medium")}>
                    {item.brand}
                  </p>
                </div>
              )}
              {item.model && (
                <div>
                  <span className={cn(
                    "text-muted-foreground",
                    classes.isRetro ? "retro-small uppercase" : "text-sm"
                  )}>
                    {t("model")}
                  </span>
                  <p className={cn(classes.isRetro ? "retro-body" : "font-medium")}>
                    {item.model}
                  </p>
                </div>
              )}
              {item.manufacturer && (
                <div>
                  <span className={cn(
                    "text-muted-foreground",
                    classes.isRetro ? "retro-small uppercase" : "text-sm"
                  )}>
                    {t("manufacturer")}
                  </span>
                  <p className={cn(classes.isRetro ? "retro-body" : "font-medium")}>
                    {item.manufacturer}
                  </p>
                </div>
              )}
              {item.serial_number && (
                <div className="col-span-2">
                  <span className={cn(
                    "text-muted-foreground",
                    classes.isRetro ? "retro-small uppercase" : "text-sm"
                  )}>
                    {t("serialNumber")}
                  </span>
                  <p className={cn(
                    "font-mono",
                    classes.isRetro ? "retro-body" : "font-medium"
                  )}>
                    {item.serial_number}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Warranty & Insurance */}
          {(item.is_insured || item.lifetime_warranty || item.warranty_details) && (
            <Card icon="Shield" title={t("warrantyInsurance")} padding="lg">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {item.is_insured && (
                    <span
                      className={cn(
                        classes.isRetro
                          ? "px-2 py-1 border-2 border-border retro-small uppercase"
                          : "px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm"
                      )}
                      style={classes.isRetro ? { backgroundColor: NES_GREEN, color: 'white' } : undefined}
                    >
                      {t("insured")}
                    </span>
                  )}
                  {item.lifetime_warranty && (
                    <span
                      className={cn(
                        classes.isRetro
                          ? "px-2 py-1 border-2 border-border retro-small uppercase"
                          : "px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm"
                      )}
                      style={classes.isRetro ? { backgroundColor: NES_BLUE, color: 'white' } : undefined}
                    >
                      {t("lifetimeWarranty")}
                    </span>
                  )}
                </div>
                {item.warranty_details && (
                  <div>
                    <span className={cn(
                      "text-muted-foreground",
                      classes.isRetro ? "retro-small uppercase" : "text-sm"
                    )}>
                      {t("warrantyDetails")}
                    </span>
                    <p className={cn("mt-1", classes.isRetro && "retro-body")}>
                      {item.warranty_details}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Inventory Locations */}
          <Card icon="MapPin" title={t("inventoryLocations")} padding="lg">
            {itemInventory.length === 0 ? (
              <p className={cn(
                "text-muted-foreground",
                classes.isRetro && "retro-body"
              )}>
                {t("noInventory")}
              </p>
            ) : (
              <div className="space-y-2">
                {itemInventory.map((inv) => (
                  <div
                    key={inv.id}
                    className={cn(
                      "flex items-center justify-between p-3 cursor-pointer transition-colors",
                      classes.isRetro
                        ? "border-2 border-border bg-muted/30 hover:bg-muted/50"
                        : "bg-muted/30 rounded-lg hover:bg-muted/50"
                    )}
                    onClick={() => router.push(`/dashboard/inventory/${inv.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Icon name="MapPin" className="w-4 h-4 text-muted-foreground" />
                      <span className={classes.isRetro ? "retro-body" : undefined}>
                        {getLocationName(inv.location_id)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        classes.isRetro
                          ? "px-2 py-1 border-2 border-border bg-background retro-small font-bold"
                          : "px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                      )}
                      style={classes.isRetro ? { color: NES_BLUE } : undefined}
                    >
                      {inv.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Linked Documents */}
          <LinkedDocuments itemId={item.id} itemName={item.name} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stock Summary */}
          <Card icon="Package" title={t("stockSummary")} padding="lg">
            <div className="text-center">
              <p
                className={cn(
                  "font-bold",
                  classes.isRetro ? "text-5xl" : "text-4xl"
                )}
                style={
                  classes.isRetro
                    ? { color: totalQuantity > 0 ? NES_GREEN : NES_RED, fontFamily: "var(--font-pixel)" }
                    : undefined
                }
              >
                <span className={cn(
                  !classes.isRetro && (totalQuantity > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")
                )}>
                  {totalQuantity}
                </span>
              </p>
              <p className={cn(
                "mt-1",
                classes.isRetro ? "text-muted-foreground retro-small uppercase" : "text-sm text-muted-foreground"
              )}>
                {t("totalInStock")}
              </p>
            </div>
            <div className={cn(
              "mt-4 pt-4",
              classes.isRetro ? "border-t-2 border-dashed border-border" : "border-t border-border"
            )}>
              <div className={cn(
                "flex justify-between items-center",
                classes.isRetro ? "retro-body uppercase" : "text-sm text-muted-foreground"
              )}>
                <span className="text-muted-foreground">{t("locations")}</span>
                <span
                  style={classes.isRetro ? { color: NES_BLUE, fontFamily: "var(--font-pixel)" } : undefined}
                  className={classes.isRetro ? "text-2xl" : undefined}
                >
                  {itemInventory.length}
                </span>
              </div>
            </div>
          </Card>

          {/* Timestamps */}
          <Card icon="Calendar" title={t("timestamps")} padding="lg">
            <div className={cn(
              "space-y-3",
              classes.isRetro ? "retro-small text-muted-foreground" : "text-sm"
            )}>
              <div>
                <span className={cn(
                  "text-muted-foreground",
                  classes.isRetro && "uppercase"
                )}>
                  {t("created")}
                </span>
                <p className={cn(
                  "text-foreground",
                  classes.isRetro && "retro-body"
                )}>
                  {formatDateTime(item.created_at, user?.date_format)}
                </p>
              </div>
              <div>
                <span className={cn(
                  "text-muted-foreground",
                  classes.isRetro && "uppercase"
                )}>
                  {t("updated")}
                </span>
                <p className={cn(
                  "text-foreground",
                  classes.isRetro && "retro-body"
                )}>
                  {formatDateTime(item.updated_at, user?.date_format)}
                </p>
              </div>
            </div>
          </Card>

          {/* Obsidian Link */}
          {item.obsidian_url && (
            <Card padding="lg">
              <a
                href={item.obsidian_url}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 transition-colors",
                  classes.isRetro
                    ? "border-2 border-border bg-purple-500/20 hover:bg-purple-500/30 retro-heading"
                    : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50"
                )}
              >
                <Icon
                  name="FileText"
                  className="w-5 h-5"
                  style={classes.isRetro ? { color: '#a855f7' } : undefined}
                />
                <span className={classes.isRetro ? "retro-small uppercase" : undefined}>
                  {t("openInObsidian")}
                </span>
              </a>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
