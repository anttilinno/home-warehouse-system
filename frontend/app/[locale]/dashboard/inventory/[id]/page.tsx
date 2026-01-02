"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { useToast } from "@/components/ui/use-toast";
import { LocationSelect } from "@/components/ui/location-select";
import { LocationBreadcrumb } from "@/components/ui/location-breadcrumb";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { formatDateTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { NES_BLUE, NES_RED } from "@/lib/nes-colors";
import { useThemed, useThemedClasses } from "@/lib/themed";

export default function InventoryEditPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const inventoryId = params.id as string;
  const t = useTranslations("inventory");
  const te = useTranslations("errors");
  const { toast } = useToast();
  const themed = useThemed();
  const classes = useThemedClasses();

  const { Button, PageHeader, Card } = themed;

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
      <div className="flex items-center justify-center min-h-[400px]">
        <p className={classes.loadingText}>{t("loading")}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error || !inventory) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p
            className={cn("mb-4", classes.errorText)}
            style={classes.isRetro ? { color: NES_RED } : undefined}
          >
            {error || "Inventory not found"}
          </p>
          <Button
            variant="primary"
            onClick={() => router.push("/dashboard/inventory")}
          >
            {t("backToList")}
          </Button>
        </div>
      </div>
    );
  }

  const item = itemMap.get(inventory.item_id);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/dashboard/inventory")}
          className={cn(
            "flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors",
            classes.isRetro && "retro-body retro-small uppercase"
          )}
        >
          <Icon name="ArrowLeft" className="w-4 h-4" />
          {t("backToList")}
        </button>
        <PageHeader title={t("editInventory")} />
      </div>

      {/* Item Info Card */}
      <Card className="mb-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "p-3",
              classes.isRetro
                ? "border-4 border-border"
                : "bg-primary/10 rounded-lg"
            )}
            style={classes.isRetro ? { backgroundColor: NES_BLUE } : undefined}
          >
            <Icon
              name="Package"
              className={cn(
                "w-8 h-8",
                classes.isRetro ? "text-white" : "text-primary"
              )}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <h2
                className={cn(
                  classes.isRetro
                    ? "text-sm font-bold uppercase retro-heading"
                    : "text-xl font-semibold"
                )}
              >
                {item?.name || "Unknown Item"}
              </h2>
              {inventory.item_id && (
                <FavoriteButton
                  entityType="ITEM"
                  entityId={inventory.item_id}
                  size="lg"
                />
              )}
            </div>
            <p
              className={cn(
                "text-muted-foreground",
                classes.isRetro ? "retro-body retro-small uppercase" : "text-sm"
              )}
            >
              {item?.sku}
            </p>
            {item?.description && (
              <p
                className={cn(
                  "text-muted-foreground mt-2",
                  classes.isRetro && "retro-body retro-small"
                )}
              >
                {item.description}
              </p>
            )}
            {inventory.location_id && (
              <div
                className={cn(
                  "mt-3 pt-3",
                  classes.isRetro
                    ? "border-t-4 border-dashed border-border"
                    : "border-t border-border"
                )}
              >
                <LocationBreadcrumb locationId={inventory.location_id} />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Edit Form */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          "space-y-6",
          classes.isRetro
            ? "retro-card p-6"
            : "bg-card border rounded-lg p-6"
        )}
      >
        {/* Location */}
        <div>
          <label
            className={cn(
              "block mb-2",
              classes.isRetro
                ? "retro-small uppercase font-bold retro-body text-foreground"
                : "text-sm font-medium text-foreground"
            )}
          >
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
          <p
            className={cn(
              "mt-1",
              classes.isRetro
                ? "text-xs uppercase text-muted-foreground retro-body"
                : "text-xs text-muted-foreground"
            )}
          >
            {t("locationChangeNote")}
          </p>
        </div>

        {/* Quantity */}
        <div>
          <label
            className={cn(
              "block mb-2",
              classes.isRetro
                ? "retro-small uppercase font-bold retro-body text-foreground"
                : "text-sm font-medium text-foreground"
            )}
          >
            {t("quantity")}
          </label>
          <input
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            className={cn(
              "w-full px-3 py-2 bg-background text-foreground focus:outline-none",
              classes.isRetro
                ? "border-4 border-border retro-body retro-small"
                : "border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            )}
          />
        </div>

        {/* Timestamps */}
        <div
          className={cn(
            "pt-4",
            classes.isRetro
              ? "border-t-4 border-dashed border-border"
              : "border-t border-border"
          )}
        >
          <div
            className={cn(
              "grid grid-cols-2 gap-4 text-muted-foreground",
              classes.isRetro
                ? "retro-small uppercase retro-body"
                : "text-sm"
            )}
          >
            <div>
              <span className={classes.isRetro ? "font-bold" : "font-medium"}>
                {t("createdAt")}:
              </span>{" "}
              {formatDateTime(inventory.created_at, user?.date_format)}
            </div>
            <div>
              <span className={classes.isRetro ? "font-bold" : "font-medium"}>
                {t("updatedAt")}:
              </span>{" "}
              {formatDateTime(inventory.updated_at, user?.date_format)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="muted"
            onClick={() => router.push("/dashboard/inventory")}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon="Save"
            disabled={submitting}
            loading={submitting}
          >
            {submitting ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
