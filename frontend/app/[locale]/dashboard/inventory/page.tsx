"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useSearchParams } from "next/navigation";
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
  InventoryCreate,
} from "@/lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  X,
  Package,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortColumn = "item" | "location" | "quantity";
type SortDirection = "asc" | "desc";

export default function InventoryPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("inventory");
  const td = useTranslations("dashboard");
  const tl = useTranslations("loans");
  const te = useTranslations("errors");

  // Get filter from URL
  const urlFilter = searchParams.get("filter") as "low-stock" | "expiring" | "warranty" | null;

  // Data state
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"low-stock" | "expiring" | "warranty" | null>(urlFilter);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("item");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);

  // Lookup maps for item/location names
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );
  const locationMap = useMemo(
    () => new Map(locations.map((loc) => [loc.id, loc])),
    [locations]
  );

  const getItemName = (itemId: string) =>
    itemMap.get(itemId)?.name || "Unknown Item";

  const getItemSku = (itemId: string) =>
    itemMap.get(itemId)?.sku || "";

  const getLocationName = (locationId: string) => {
    const loc = locationMap.get(locationId);
    if (!loc) return "Unknown Location";
    const parts = [loc.name];
    if (loc.zone) parts.push(loc.zone);
    if (loc.shelf) parts.push(loc.shelf);
    if (loc.bin) parts.push(loc.bin);
    return parts.join(" / ");
  };

  // Filter inventory based on active filter and search term
  const LOW_STOCK_THRESHOLD = 5;
  const EXPIRING_SOON_DAYS = 30;
  const filteredInventory = useMemo(() => {
    let result = inventory;

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((inv) => {
        const item = itemMap.get(inv.item_id);
        const location = locationMap.get(inv.location_id);
        const itemName = item?.name?.toLowerCase() || "";
        const itemSku = item?.sku?.toLowerCase() || "";
        const locationName = location?.name?.toLowerCase() || "";
        return itemName.includes(term) || itemSku.includes(term) || locationName.includes(term);
      });
    }

    // Apply status filter
    if (activeFilter) {
      const now = new Date();
      const expiringThreshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

      switch (activeFilter) {
        case "low-stock":
          result = result.filter((inv) => inv.quantity <= LOW_STOCK_THRESHOLD && inv.quantity > 0);
          break;
        case "expiring":
          result = result.filter((inv) => {
            if (!inv.expiration_date) return false;
            const expDate = new Date(inv.expiration_date);
            return expDate <= expiringThreshold && expDate >= now;
          });
          break;
        case "warranty":
          result = result.filter((inv) => {
            if (!inv.warranty_expires) return false;
            const warrantyDate = new Date(inv.warranty_expires);
            return warrantyDate <= expiringThreshold && warrantyDate >= now;
          });
          break;
      }
    }

    // Apply sorting
    const sorted = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "item":
          const itemA = itemMap.get(a.item_id)?.name?.toLowerCase() || "";
          const itemB = itemMap.get(b.item_id)?.name?.toLowerCase() || "";
          comparison = itemA.localeCompare(itemB);
          break;
        case "location":
          const locA = locationMap.get(a.location_id)?.name?.toLowerCase() || "";
          const locB = locationMap.get(b.location_id)?.name?.toLowerCase() || "";
          comparison = locA.localeCompare(locB);
          break;
        case "quantity":
          comparison = a.quantity - b.quantity;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [inventory, activeFilter, searchTerm, itemMap, locationMap, sortColumn, sortDirection]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [inventoryData, itemsData, locationsData] = await Promise.all([
        inventoryApi.list(),
        itemsApi.list(),
        locationsApi.list(),
      ]);
      setInventory(inventoryData);
      setItems(itemsData);
      setLocations(locationsData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load inventory";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (inv: Inventory) => {
    setSelectedInventory(inv);
    setIsEditModalOpen(true);
  };

  const handleAdjust = (inv: Inventory) => {
    setSelectedInventory(inv);
    setIsAdjustModalOpen(true);
  };

  const handleDelete = (inv: Inventory) => {
    setSelectedInventory(inv);
    setIsDeleteModalOpen(true);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ChevronUp className="w-4 h-4 opacity-0 group-hover:opacity-30" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("addInventory")}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={tl("searchInventory")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setActiveFilter(activeFilter === "low-stock" ? null : "low-stock")}
            className={cn(
              "px-4 py-2 rounded-lg border transition-colors",
              activeFilter === "low-stock"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            {td("lowStock")}
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === "expiring" ? null : "expiring")}
            className={cn(
              "px-4 py-2 rounded-lg border transition-colors",
              activeFilter === "expiring"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            {td("expiringSoon")}
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === "warranty" ? null : "warranty")}
            className={cn(
              "px-4 py-2 rounded-lg border transition-colors",
              activeFilter === "warranty"
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            {td("warrantyExpiring")}
          </button>
        </div>
      </div>

      {/* Table */}
      {filteredInventory.length === 0 ? (
        <div className="bg-card border rounded-lg p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("noInventory")}</p>
          {canEdit && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("addInventory")}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors group"
                  onClick={() => handleSort("item")}
                >
                  <div className="flex items-center gap-1">
                    {t("item")}
                    <SortIcon column="item" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors group"
                  onClick={() => handleSort("location")}
                >
                  <div className="flex items-center gap-1">
                    {t("location")}
                    <SortIcon column="location" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors group"
                  onClick={() => handleSort("quantity")}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t("quantity")}
                    <SortIcon column="quantity" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInventory.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/inventory/${inv.id}`)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-foreground hover:text-primary">
                        {getItemName(inv.item_id)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getItemSku(inv.item_id)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {getLocationName(inv.location_id)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {inv.quantity}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleAdjust(inv)}
                          title={t("adjustStock")}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <ArrowUpDown className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button
                          onClick={() => handleEdit(inv)}
                          title={t("edit")}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(inv)}
                          title={t("delete")}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <CreateEditModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          fetchData();
        }}
        items={items}
        locations={locations}
        t={t}
        te={te}
      />

      {/* Edit Modal */}
      <CreateEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedInventory(null);
        }}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedInventory(null);
          fetchData();
        }}
        inventory={selectedInventory}
        items={items}
        locations={locations}
        t={t}
        te={te}
      />

      {/* Stock Adjustment Modal */}
      {selectedInventory && (
        <AdjustStockModal
          isOpen={isAdjustModalOpen}
          onClose={() => {
            setIsAdjustModalOpen(false);
            setSelectedInventory(null);
          }}
          onSuccess={() => {
            setIsAdjustModalOpen(false);
            setSelectedInventory(null);
            fetchData();
          }}
          inventory={selectedInventory}
          itemName={getItemName(selectedInventory.item_id)}
          locationName={getLocationName(selectedInventory.location_id)}
          t={t}
          te={te}
        />
      )}

      {/* Delete Confirmation Modal */}
      {selectedInventory && (
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedInventory(null);
          }}
          onSuccess={() => {
            setIsDeleteModalOpen(false);
            setSelectedInventory(null);
            fetchData();
          }}
          inventory={selectedInventory}
          itemName={getItemName(selectedInventory.item_id)}
          locationName={getLocationName(selectedInventory.location_id)}
          t={t}
          te={te}
        />
      )}
    </>
  );
}

// Create/Edit Modal Component
function CreateEditModal({
  isOpen,
  onClose,
  onSuccess,
  inventory,
  items,
  locations,
  t,
  te,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inventory?: Inventory | null;
  items: Item[];
  locations: Location[];
  t: (key: string) => string;
  te: (key: string) => string;
}) {
  const isEdit = !!inventory;
  const [formData, setFormData] = useState<InventoryCreate>({
    item_id: "",
    location_id: "",
    quantity: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inventory) {
      setFormData({
        item_id: inventory.item_id,
        location_id: inventory.location_id,
        quantity: inventory.quantity,
      });
    } else {
      setFormData({ item_id: "", location_id: "", quantity: 0 });
    }
    setError(null);
  }, [inventory, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && inventory) {
        await inventoryApi.update(inventory.id, { quantity: formData.quantity });
      } else {
        await inventoryApi.create(formData);
      }
      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getTranslatedErrorMessage(err.message, te)
          : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md m-4 bg-background border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEdit ? t("editInventory") : t("addInventory")}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("item")}
            </label>
            <select
              value={formData.item_id}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, item_id: e.target.value }))
              }
              disabled={isEdit}
              className={cn(
                "w-full px-3 py-2 border border-border rounded-md bg-background text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                isEdit && "opacity-50 cursor-not-allowed"
              )}
              required
            >
              <option value="">{t("selectItem")}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("location")}
            </label>
            <select
              value={formData.location_id}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, location_id: e.target.value }))
              }
              disabled={isEdit}
              className={cn(
                "w-full px-3 py-2 border border-border rounded-md bg-background text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                isEdit && "opacity-50 cursor-not-allowed"
              )}
              required
            >
              <option value="">{t("selectLocation")}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {loc.zone && ` / ${loc.zone}`}
                  {loc.shelf && ` / ${loc.shelf}`}
                  {loc.bin && ` / ${loc.bin}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("quantity")}
            </label>
            <input
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  quantity: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Stock Adjustment Modal Component
function AdjustStockModal({
  isOpen,
  onClose,
  onSuccess,
  inventory,
  itemName,
  locationName,
  t,
  te,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inventory: Inventory;
  itemName: string;
  locationName: string;
  t: (key: string) => string;
  te: (key: string) => string;
}) {
  const [adjustment, setAdjustment] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newQuantity = inventory.quantity + adjustment;

  useEffect(() => {
    setAdjustment(0);
    setError(null);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustment === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await inventoryApi.adjustStock(inventory.id, { quantity_change: adjustment });
      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getTranslatedErrorMessage(err.message, te)
          : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md m-4 bg-background border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t("adjustStockTitle")}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{itemName}</span>
            </p>
            <p>{locationName}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">{t("currentQuantity")}</p>
              <p className="text-2xl font-bold">{inventory.quantity}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("newQuantity")}</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  newQuantity < 0 && "text-destructive"
                )}
              >
                {newQuantity}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("adjustment")}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustment((a) => a - 10)}
                className="px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                -10
              </button>
              <button
                type="button"
                onClick={() => setAdjustment((a) => a - 1)}
                className="px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                -1
              </button>
              <input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setAdjustment((a) => a + 1)}
                className="px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => setAdjustment((a) => a + 10)}
                className="px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                +10
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || newQuantity < 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? t("saving") : t("apply")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal Component
function DeleteConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  inventory,
  itemName,
  locationName,
  t,
  te,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inventory: Inventory;
  itemName: string;
  locationName: string;
  t: (key: string) => string;
  te: (key: string) => string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await inventoryApi.delete(inventory.id);
      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getTranslatedErrorMessage(err.message, te)
          : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md m-4 bg-background border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-destructive">
            {t("deleteConfirmTitle")}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <p className="text-muted-foreground">{t("deleteConfirmMessage")}</p>

          <div className="p-3 bg-muted rounded-md">
            <p className="font-medium">{itemName}</p>
            <p className="text-sm text-muted-foreground">{locationName}</p>
            <p className="text-sm text-muted-foreground">
              {t("quantity")}: {inventory.quantity}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {submitting ? t("deleting") : t("deleteConfirmButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
