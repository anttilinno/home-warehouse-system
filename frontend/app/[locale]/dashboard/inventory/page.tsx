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
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { NES_RED, NES_AMBER } from "@/lib/nes-colors";
import { useThemed, useThemedClasses } from "@/lib/themed";
import type { ThemedComponents } from "@/lib/themed";

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
  const themed = useThemed();
  const classes = useThemedClasses();

  const { PageHeader, Button, Table, EmptyState } = themed;

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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message || "Failed to load inventory";
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
      return <Icon name="ChevronUp" className="w-4 h-4 opacity-0 group-hover:opacity-30" />;
    }
    return sortDirection === "asc" ? (
      <Icon name="ChevronUp" className="w-4 h-4" />
    ) : (
      <Icon name="ChevronDown" className="w-4 h-4" />
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className={classes.loadingText}>
          {classes.isRetro ? "Loading..." : t("loading")}
        </p>
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
          <p className={cn(classes.errorText, "mb-4")} style={classes.isRetro ? { color: NES_RED } : undefined}>
            {error}
          </p>
          <Button variant="primary" onClick={fetchData}>
            {t("tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          canEdit && (
            <Button
              variant={classes.isRetro ? "secondary" : "primary"}
              icon="Plus"
              onClick={() => setIsCreateModalOpen(true)}
            >
              {t("addInventory")}
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={tl("searchInventory")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              classes.isRetro
                ? "retro-input pl-10"
                : "w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            )}
          />
        </div>
        <button
          onClick={() => setActiveFilter(activeFilter === "low-stock" ? null : "low-stock")}
          className={cn(
            classes.isRetro
              ? cn(
                  "retro-btn retro-btn--sm",
                  activeFilter === "low-stock" ? "retro-btn--warning" : "retro-btn--secondary"
                )
              : cn(
                  "px-4 py-2 rounded-lg border transition-colors",
                  activeFilter === "low-stock"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )
          )}
          style={classes.isRetro && activeFilter === "low-stock" ? { backgroundColor: NES_AMBER, color: "black" } : undefined}
        >
          {td("lowStock")}
        </button>
        <button
          onClick={() => setActiveFilter(activeFilter === "expiring" ? null : "expiring")}
          className={cn(
            classes.isRetro
              ? cn(
                  "retro-btn retro-btn--sm",
                  activeFilter === "expiring" ? "retro-btn--warning" : "retro-btn--secondary"
                )
              : cn(
                  "px-4 py-2 rounded-lg border transition-colors",
                  activeFilter === "expiring"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )
          )}
          style={classes.isRetro && activeFilter === "expiring" ? { backgroundColor: NES_AMBER, color: "black" } : undefined}
        >
          {td("expiringSoon")}
        </button>
        <button
          onClick={() => setActiveFilter(activeFilter === "warranty" ? null : "warranty")}
          className={cn(
            classes.isRetro
              ? cn(
                  "retro-btn retro-btn--sm",
                  activeFilter === "warranty" ? "retro-btn--info" : "retro-btn--secondary"
                )
              : cn(
                  "px-4 py-2 rounded-lg border transition-colors",
                  activeFilter === "warranty"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )
          )}
        >
          {td("warrantyExpiring")}
        </button>
      </div>

      {/* Empty State or Table */}
      {filteredInventory.length === 0 ? (
        <EmptyState
          icon="Package"
          message={t("noInventory")}
          action={
            canEdit
              ? {
                  label: t("addInventory"),
                  onClick: () => setIsCreateModalOpen(true),
                  icon: "Plus",
                }
              : undefined
          }
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.Th
                sortable
                active={sortColumn === "item"}
                onClick={() => handleSort("item")}
                className="group"
              >
                <div className="flex items-center gap-1">
                  {t("item")}
                  <SortIcon column="item" />
                </div>
              </Table.Th>
              <Table.Th
                sortable
                active={sortColumn === "location"}
                onClick={() => handleSort("location")}
                className="group"
              >
                <div className="flex items-center gap-1">
                  {t("location")}
                  <SortIcon column="location" />
                </div>
              </Table.Th>
              <Table.Th
                align="right"
                sortable
                active={sortColumn === "quantity"}
                onClick={() => handleSort("quantity")}
                className="group"
              >
                <div className="flex items-center justify-end gap-1">
                  {t("quantity")}
                  <SortIcon column="quantity" />
                </div>
              </Table.Th>
              <Table.Th align="right">
                {t("actions")}
              </Table.Th>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {filteredInventory.map((inv) => (
              <Table.Row
                key={inv.id}
                clickable
                onClick={() => router.push(`/dashboard/inventory/${inv.id}`)}
              >
                <Table.Td>
                  <div>
                    <div className={cn(
                      "text-foreground hover:text-primary",
                      classes.isRetro ? "retro-body retro-small uppercase" : "font-medium"
                    )}>
                      {getItemName(inv.item_id)}
                    </div>
                    <div className={cn(
                      "text-muted-foreground",
                      classes.isRetro ? "retro-body text-xs uppercase" : "text-sm"
                    )}>
                      {getItemSku(inv.item_id)}
                    </div>
                  </div>
                </Table.Td>
                <Table.Td>
                  {getLocationName(inv.location_id)}
                </Table.Td>
                <Table.Td align="right" className={classes.isRetro ? undefined : "font-mono"}>
                  {inv.quantity}
                </Table.Td>
                <Table.Td align="right">
                  {canEdit && (
                    <div
                      className={classes.isRetro ? "retro-td__actions" : "flex justify-end gap-2"}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleAdjust(inv)}
                        title={t("adjustStock")}
                        className={classes.isRetro ? "retro-icon-btn" : "p-1.5 rounded hover:bg-muted transition-colors"}
                      >
                        <Icon name="ArrowUpDown" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={() => handleEdit(inv)}
                        title={t("edit")}
                        className={classes.isRetro ? "retro-icon-btn" : "p-1.5 rounded hover:bg-muted transition-colors"}
                      >
                        <Icon name="Pencil" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(inv)}
                        title={t("delete")}
                        className={classes.isRetro ? "retro-icon-btn retro-icon-btn--danger" : "p-1.5 rounded hover:bg-muted transition-colors"}
                      >
                        <Icon
                          name="Trash2"
                          className={cn("w-4 h-4", classes.isRetro ? "" : "text-muted-foreground hover:text-destructive")}
                          style={classes.isRetro ? { color: NES_RED } : undefined}
                        />
                      </button>
                    </div>
                  )}
                </Table.Td>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Modals */}
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
        themed={themed}
      />

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
        themed={themed}
      />

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
          themed={themed}
        />
      )}

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
          themed={themed}
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
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inventory?: Inventory | null;
  items: Item[];
  locations: Location[];
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, FormGroup, Label, Input, Select, Error } = themed;
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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
        ? getTranslatedErrorMessage(err.message, te)
        : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header title={isEdit ? t("editInventory") : t("addInventory")} />
      <Modal.Body>
        <form id="inventory-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className={themed.isRetro ? "retro-card p-3" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"}>
              <Error>{error}</Error>
            </div>
          )}

          <FormGroup>
            <Label htmlFor="item">{t("item")}</Label>
            <Select
              id="item"
              value={formData.item_id}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, item_id: e.target.value }))
              }
              disabled={isEdit}
              required
            >
              <option value="">{t("selectItem")}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup>
            <Label htmlFor="location">{t("location")}</Label>
            <Select
              id="location"
              value={formData.location_id}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, location_id: e.target.value }))
              }
              disabled={isEdit}
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
            </Select>
          </FormGroup>

          <FormGroup>
            <Label htmlFor="quantity">{t("quantity")}</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  quantity: parseInt(e.target.value) || 0,
                }))
              }
              required
            />
          </FormGroup>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          type="submit"
          form="inventory-form"
          loading={submitting}
        >
          {t("save")}
        </Button>
      </Modal.Footer>
    </Modal>
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
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inventory: Inventory;
  itemName: string;
  locationName: string;
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, FormGroup, Label, Input, Error } = themed;

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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
        ? getTranslatedErrorMessage(err.message, te)
        : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header title={t("adjustStockTitle")} />
      <Modal.Body>
        {error && (
          <div className={themed.isRetro ? "retro-card p-3 mb-4" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4"}>
            <Error>{error}</Error>
          </div>
        )}

        <div className={cn("mb-4", themed.isRetro ? "retro-body" : "text-sm text-muted-foreground")}>
          <p className={themed.isRetro ? "retro-heading" : "font-medium text-foreground"}>{itemName}</p>
          <p className="text-muted-foreground">{locationName}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 py-2 mb-4">
          <div>
            <p className={cn("text-muted-foreground", themed.isRetro ? "retro-body" : "text-sm")}>{t("currentQuantity")}</p>
            <p className={cn(themed.isRetro ? "retro-heading text-xl" : "text-2xl font-bold")}>{inventory.quantity}</p>
          </div>
          <div>
            <p className={cn("text-muted-foreground", themed.isRetro ? "retro-body" : "text-sm")}>{t("newQuantity")}</p>
            <p
              className={cn(themed.isRetro ? "retro-heading text-xl" : "text-2xl font-bold", newQuantity < 0 && "text-destructive")}
              style={themed.isRetro && newQuantity < 0 ? { color: NES_RED } : undefined}
            >
              {newQuantity}
            </p>
          </div>
        </div>

        <FormGroup>
          <Label>{t("adjustment")}</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAdjustment((a) => a - 10)}
            >
              -10
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAdjustment((a) => a - 1)}
            >
              -1
            </Button>
            <Input
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
              className="flex-1 text-center"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAdjustment((a) => a + 1)}
            >
              +1
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAdjustment((a) => a + 10)}
            >
              +10
            </Button>
          </div>
        </FormGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={newQuantity < 0}
        >
          {t("apply")}
        </Button>
      </Modal.Footer>
    </Modal>
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
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inventory: Inventory;
  itemName: string;
  locationName: string;
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, Error } = themed;
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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
        ? getTranslatedErrorMessage(err.message, te)
        : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header title={t("deleteConfirmTitle")} variant="danger" />
      <Modal.Body>
        {error && (
          <div className={themed.isRetro ? "retro-card p-3 mb-4" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4"}>
            <Error>{error}</Error>
          </div>
        )}

        <p className={cn("text-muted-foreground mb-4", themed.isRetro ? "retro-body" : "")}>
          {t("deleteConfirmMessage")}
        </p>

        <Modal.Preview>
          <p className={themed.isRetro ? "retro-heading" : "font-medium"}>{itemName}</p>
          <p className="text-muted-foreground">{locationName}</p>
          <p className="text-muted-foreground">
            {t("quantity")}: {inventory.quantity}
          </p>
        </Modal.Preview>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          loading={submitting}
        >
          {t("deleteConfirmButton")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
