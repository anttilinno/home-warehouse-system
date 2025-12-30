"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
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
import { ArrowLeft, Tag, Package, MapPin, Shield, Calendar } from "lucide-react";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { LinkedDocuments } from "@/components/docspell";
import { formatDateTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";
import { RetroPageHeader, RetroButton } from "@/components/retro";

export default function ItemDetailPage() {
  const { isAuthenticated, isLoading: authLoading, user, canEdit } = useAuth();
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;
  const t = useTranslations("items");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

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
        isRetro && "retro-body"
      )}>
        <div className={cn(
          "text-muted-foreground",
          isRetro && "retro-small uppercase"
        )}>{t("loading")}</div>
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
        isRetro && "retro-body"
      )}>
        <div className="text-center">
          <p className={cn(
            "text-red-500 mb-4",
            isRetro && "retro-small uppercase"
          )} style={isRetro ? { color: NES_RED } : undefined}>{error || t("itemNotFound")}</p>
          {isRetro ? (
            <RetroButton
              variant="primary"
              onClick={() => router.push("/dashboard/items")}
            >
              {t("backToList")}
            </RetroButton>
          ) : (
            <button
              onClick={() => router.push("/dashboard/items")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              {t("backToList")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const categoryName = getCategoryName(item.category_id);

  // Retro theme UI
  if (isRetro) {
    return (
      <div className="w-full">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard/items")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors retro-body retro-small uppercase"
          >
            <Icon name="ArrowLeft" className="w-4 h-4" />
            {t("backToList")}
          </button>
          <RetroPageHeader
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
                  <RetroButton
                    variant="primary"
                    icon="Pencil"
                    onClick={() => router.push(`/dashboard/items?edit=${item.id}`)}
                  >
                    {t("edit")}
                  </RetroButton>
                )}
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="retro-card p-6">
              <h3 className="retro-small uppercase font-bold retro-heading mb-4 flex items-center gap-2">
                <Icon name="Tag" className="w-4 h-4" />
                {t("basicInfo")}
              </h3>

              {item.description && (
                <p className="text-muted-foreground retro-body mb-4">{item.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                {categoryName && (
                  <div>
                    <span className="text-muted-foreground retro-small uppercase">{t("category")}</span>
                    <p className="retro-body">{categoryName}</p>
                  </div>
                )}
                {item.brand && (
                  <div>
                    <span className="text-muted-foreground retro-small uppercase">{t("brand")}</span>
                    <p className="retro-body">{item.brand}</p>
                  </div>
                )}
                {item.model && (
                  <div>
                    <span className="text-muted-foreground retro-small uppercase">{t("model")}</span>
                    <p className="retro-body">{item.model}</p>
                  </div>
                )}
                {item.manufacturer && (
                  <div>
                    <span className="text-muted-foreground retro-small uppercase">{t("manufacturer")}</span>
                    <p className="retro-body">{item.manufacturer}</p>
                  </div>
                )}
                {item.serial_number && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground retro-small uppercase">{t("serialNumber")}</span>
                    <p className="retro-body font-mono">{item.serial_number}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Warranty & Insurance */}
            {(item.is_insured || item.lifetime_warranty || item.warranty_details) && (
              <div className="retro-card p-6">
                <h3 className="retro-small uppercase font-bold retro-heading mb-4 flex items-center gap-2">
                  <Icon name="Shield" className="w-4 h-4" />
                  {t("warrantyInsurance")}
                </h3>
                <div className="space-y-3">
                  {item.is_insured && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 border-2 border-border retro-small uppercase" style={{ backgroundColor: NES_GREEN, color: 'white' }}>
                        {t("insured")}
                      </span>
                    </div>
                  )}
                  {item.lifetime_warranty && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 border-2 border-border retro-small uppercase" style={{ backgroundColor: NES_BLUE, color: 'white' }}>
                        {t("lifetimeWarranty")}
                      </span>
                    </div>
                  )}
                  {item.warranty_details && (
                    <div>
                      <span className="text-muted-foreground retro-small uppercase">{t("warrantyDetails")}</span>
                      <p className="retro-body mt-1">{item.warranty_details}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Inventory Locations */}
            <div className="retro-card p-6">
              <h3 className="retro-small uppercase font-bold retro-heading mb-4 flex items-center gap-2">
                <Icon name="MapPin" className="w-4 h-4" />
                {t("inventoryLocations")}
              </h3>
              {itemInventory.length === 0 ? (
                <p className="text-muted-foreground retro-body">{t("noInventory")}</p>
              ) : (
                <div className="space-y-2">
                  {itemInventory.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 border-2 border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/dashboard/inventory/${inv.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Icon name="MapPin" className="w-4 h-4 text-muted-foreground" />
                        <span className="retro-body">{getLocationName(inv.location_id)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 border-2 border-border bg-background retro-small font-bold" style={{ color: NES_BLUE }}>
                          {inv.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Documents */}
            <LinkedDocuments itemId={item.id} itemName={item.name} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stock Summary */}
            <div className="retro-card p-6">
              <h3 className="retro-small uppercase font-bold retro-heading mb-4 flex items-center gap-2">
                <Icon name="Package" className="w-4 h-4" />
                {t("stockSummary")}
              </h3>
              <div className="text-center">
                <p
                  className="text-5xl font-bold"
                  style={{ color: totalQuantity > 0 ? NES_GREEN : NES_RED, fontFamily: "var(--font-pixel)" }}
                >
                  {totalQuantity}
                </p>
                <p className="text-muted-foreground retro-small uppercase mt-1">{t("totalInStock")}</p>
              </div>
              <div className="mt-4 pt-4 border-t-2 border-dashed border-border">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground retro-body uppercase">{t("locations")}</span>
                  <span className="text-2xl" style={{ color: NES_BLUE, fontFamily: "var(--font-pixel)" }}>{itemInventory.length}</span>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="retro-card p-6">
              <h3 className="retro-small uppercase font-bold retro-heading mb-4 flex items-center gap-2">
                <Icon name="Calendar" className="w-4 h-4" />
                {t("timestamps")}
              </h3>
              <div className="space-y-3 retro-small text-muted-foreground">
                <div>
                  <span className="uppercase">{t("created")}</span>
                  <p className="text-foreground retro-body">{formatDateTime(item.created_at, user?.date_format)}</p>
                </div>
                <div>
                  <span className="uppercase">{t("updated")}</span>
                  <p className="text-foreground retro-body">{formatDateTime(item.updated_at, user?.date_format)}</p>
                </div>
              </div>
            </div>

            {/* Obsidian Link */}
            {item.obsidian_url && (
              <div className="retro-card p-6">
                <a
                  href={item.obsidian_url}
                  className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-border bg-purple-500/20 hover:bg-purple-500/30 transition-colors retro-heading"
                >
                  <Icon name="FileText" className="w-5 h-5" style={{ color: '#a855f7' }} />
                  <span className="retro-small uppercase">{t("openInObsidian")}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard theme UI
  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/dashboard/items")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("backToList")}
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{item.name}</h1>
            <p className="text-muted-foreground mt-1 font-mono">{item.sku}</p>
          </div>
          <div className="flex items-center gap-2">
            <FavoriteButton
              entityType="ITEM"
              entityId={item.id}
              size="lg"
            />
            {canEdit && (
              <button
                onClick={() => router.push(`/dashboard/items?edit=${item.id}`)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <Tag className="w-4 h-4" />
                {t("edit")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-card border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {t("basicInfo")}
            </h3>

            {item.description && (
              <p className="text-muted-foreground mb-4">{item.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              {categoryName && (
                <div>
                  <span className="text-sm text-muted-foreground">{t("category")}</span>
                  <p className="font-medium">{categoryName}</p>
                </div>
              )}
              {item.brand && (
                <div>
                  <span className="text-sm text-muted-foreground">{t("brand")}</span>
                  <p className="font-medium">{item.brand}</p>
                </div>
              )}
              {item.model && (
                <div>
                  <span className="text-sm text-muted-foreground">{t("model")}</span>
                  <p className="font-medium">{item.model}</p>
                </div>
              )}
              {item.manufacturer && (
                <div>
                  <span className="text-sm text-muted-foreground">{t("manufacturer")}</span>
                  <p className="font-medium">{item.manufacturer}</p>
                </div>
              )}
              {item.serial_number && (
                <div className="col-span-2">
                  <span className="text-sm text-muted-foreground">{t("serialNumber")}</span>
                  <p className="font-medium font-mono">{item.serial_number}</p>
                </div>
              )}
            </div>
          </div>

          {/* Warranty & Insurance */}
          {(item.is_insured || item.lifetime_warranty || item.warranty_details) && (
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t("warrantyInsurance")}
              </h3>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {item.is_insured && (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm">
                      {t("insured")}
                    </span>
                  )}
                  {item.lifetime_warranty && (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                      {t("lifetimeWarranty")}
                    </span>
                  )}
                </div>
                {item.warranty_details && (
                  <div>
                    <span className="text-sm text-muted-foreground">{t("warrantyDetails")}</span>
                    <p className="mt-1">{item.warranty_details}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inventory Locations */}
          <div className="bg-card border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t("inventoryLocations")}
            </h3>
            {itemInventory.length === 0 ? (
              <p className="text-muted-foreground">{t("noInventory")}</p>
            ) : (
              <div className="space-y-2">
                {itemInventory.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/inventory/${inv.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{getLocationName(inv.location_id)}</span>
                    </div>
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {inv.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked Documents */}
          <LinkedDocuments itemId={item.id} itemName={item.name} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stock Summary */}
          <div className="bg-card border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t("stockSummary")}
            </h3>
            <div className="text-center">
              <p className={cn(
                "text-4xl font-bold",
                totalQuantity > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {totalQuantity}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t("totalInStock")}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t("locations")}</span>
                <span>{itemInventory.length}</span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-card border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t("timestamps")}
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t("created")}</span>
                <p>{formatDateTime(item.created_at, user?.date_format)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("updated")}</span>
                <p>{formatDateTime(item.updated_at, user?.date_format)}</p>
              </div>
            </div>
          </div>

          {/* Obsidian Link */}
          {item.obsidian_url && (
            <div className="bg-card border rounded-lg p-6">
              <a
                href={item.obsidian_url}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                <Tag className="w-5 h-5" />
                {t("openInObsidian")}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
