"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import {
  inventoryApi,
  itemsApi,
  locationsApi,
  getTranslatedErrorMessage,
  Inventory,
  Item,
  Location,
} from "@/lib/api";
import { Icon } from "@/components/icons";
import { ArrowLeft, Package, MapPin, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { LocationSelect } from "@/components/ui/location-select";
import { LocationBreadcrumb } from "@/components/ui/location-breadcrumb";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { formatDateTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED } from "@/lib/nes-colors";
import { RetroPageHeader, RetroButton } from "@/components/retro";

export default function InventoryEditPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const inventoryId = params.id as string;
  const t = useTranslations("inventory");
  const te = useTranslations("errors");
  const { toast } = useToast();
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

  // Data state
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [quantity, setQuantity] = useState(0);
  const [locationId, setLocationId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Lookup maps
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );

  const getItemName = (itemId: string) =>
    itemMap.get(itemId)?.name || "Unknown Item";

  const getItemSku = (itemId: string) =>
    itemMap.get(itemId)?.sku || "";

  useEffect(() => {
    if (isAuthenticated && inventoryId) {
      fetchData();
    }
  }, [isAuthenticated, inventoryId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [inventoryData, itemsData, locationsData] = await Promise.all([
        inventoryApi.get(inventoryId),
        itemsApi.list(),
        locationsApi.list(),
      ]);
      setInventory(inventoryData);
      setItems(itemsData);
      setLocations(locationsData);
      setQuantity(inventoryData.quantity);
      setLocationId(inventoryData.location_id);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load inventory";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventory) return;

    setSubmitting(true);
    try {
      await inventoryApi.update(inventory.id, { quantity });
      toast({
        title: t("updated"),
        description: getItemName(inventory.item_id),
      });
      router.push("/dashboard/inventory");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getTranslatedErrorMessage(err.message, te)
          : te("UNKNOWN_ERROR");
      toast({
        title: te("UNKNOWN_ERROR"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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

  if (error || !inventory) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        isRetro && "retro-body"
      )}>
        <div className="text-center">
          <p className={cn(
            "text-red-500 mb-4",
            isRetro && "retro-small uppercase"
          )} style={isRetro ? { color: NES_RED } : undefined}>{error || "Inventory not found"}</p>
          {isRetro ? (
            <RetroButton
              variant="primary"
              onClick={() => router.push("/dashboard/inventory")}
            >
              {t("backToList")}
            </RetroButton>
          ) : (
            <button
              onClick={() => router.push("/dashboard/inventory")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              {t("backToList")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const item = itemMap.get(inventory.item_id);

  // Retro theme UI
  if (isRetro) {
    return (
      <div className="w-full">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard/inventory")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors retro-body retro-small uppercase"
          >
            <Icon name="ArrowLeft" className="w-4 h-4" />
            {t("backToList")}
          </button>
          <RetroPageHeader title={t("editInventory")} />
        </div>

        {/* Item Info Card */}
        <div className="retro-card p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 border-4 border-border" style={{ backgroundColor: NES_BLUE }}>
              <Icon name="Package" className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <h2 className="text-sm font-bold uppercase retro-heading">{item?.name || "Unknown Item"}</h2>
                {inventory.item_id && (
                  <FavoriteButton
                    entityType="ITEM"
                    entityId={inventory.item_id}
                    size="lg"
                  />
                )}
              </div>
              <p className="text-muted-foreground retro-body retro-small uppercase">{item?.sku}</p>
              {item?.description && (
                <p className="text-muted-foreground retro-body retro-small mt-2">{item.description}</p>
              )}
              {inventory.location_id && (
                <div className="mt-3 pt-3 border-t-4 border-dashed border-border">
                  <LocationBreadcrumb locationId={inventory.location_id} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="retro-card p-6 space-y-6">
          {/* Location */}
          <div>
            <label className="block retro-small uppercase font-bold retro-body text-foreground mb-2">
              <Icon name="MapPin" className="w-4 h-4 inline mr-2" />
              {t("location")}
            </label>
            <LocationSelect
              locations={locations}
              value={locationId}
              onChange={(val) => setLocationId(val || "")}
              allowNone={false}
              placeholder={t("selectLocation")}
            />
            <p className="text-xs uppercase text-muted-foreground mt-1 retro-body">
              {t("locationChangeNote")}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className="block retro-small uppercase font-bold retro-body text-foreground mb-2">
              {t("quantity")}
            </label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border-4 border-border bg-background text-foreground retro-body retro-small focus:outline-none"
            />
          </div>

          {/* Timestamps */}
          <div className="pt-4 border-t-4 border-dashed border-border">
            <div className="grid grid-cols-2 gap-4 retro-small uppercase text-muted-foreground retro-body">
              <div>
                <span className="font-bold">{t("createdAt")}:</span>{" "}
                {formatDateTime(inventory.created_at, user?.date_format)}
              </div>
              <div>
                <span className="font-bold">{t("updatedAt")}:</span>{" "}
                {formatDateTime(inventory.updated_at, user?.date_format)}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <RetroButton
              type="button"
              variant="muted"
              onClick={() => router.push("/dashboard/inventory")}
            >
              {t("cancel")}
            </RetroButton>
            <RetroButton
              type="submit"
              variant="primary"
              icon="Save"
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? t("saving") : t("save")}
            </RetroButton>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/dashboard/inventory")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("backToList")}
        </button>
        <h1 className="text-3xl font-bold text-foreground">{t("editInventory")}</h1>
      </div>

      {/* Item Info Card */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-semibold">{item?.name || "Unknown Item"}</h2>
              {inventory.item_id && (
                <FavoriteButton
                  entityType="ITEM"
                  entityId={inventory.item_id}
                  size="lg"
                />
              )}
            </div>
            <p className="text-muted-foreground text-sm">{item?.sku}</p>
            {item?.description && (
              <p className="text-muted-foreground mt-2">{item.description}</p>
            )}
            {inventory.location_id && (
              <div className="mt-3 pt-3 border-t border-border">
                <LocationBreadcrumb locationId={inventory.location_id} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="bg-card border rounded-lg p-6 space-y-6">
        {/* Location (read-only for now, could be made editable) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            <MapPin className="w-4 h-4 inline mr-2" />
            {t("location")}
          </label>
          <LocationSelect
            locations={locations}
            value={locationId}
            onChange={(val) => setLocationId(val || "")}
            allowNone={false}
            placeholder={t("selectLocation")}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t("locationChangeNote")}
          </p>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t("quantity")}
          </label>
          <input
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Timestamps */}
        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">{t("createdAt")}:</span>{" "}
              {formatDateTime(inventory.created_at, user?.date_format)}
            </div>
            <div>
              <span className="font-medium">{t("updatedAt")}:</span>{" "}
              {formatDateTime(inventory.updated_at, user?.date_format)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard/inventory")}
            className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {submitting ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
