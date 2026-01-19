"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Plus,
  Search,
  Package,
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Move,
  MapPin,
  Box,
  Download,
  Upload,
  CheckCircle,
  CheckCircle2,
  HandCoins,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortableTableHead,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { InfiniteScrollTrigger } from "@/components/ui/infinite-scroll-trigger";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterPopover } from "@/components/ui/filter-popover";
import { ExportDialog } from "@/components/ui/export-dialog";
import { ImportDialog, type ImportResult } from "@/components/ui/import-dialog";
import { InlineEditCell } from "@/components/ui/inline-edit-cell";
import { InlineEditSelect } from "@/components/ui/inline-edit-select";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useFilters } from "@/lib/hooks/use-filters";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useSSE, type SSEEvent } from "@/lib/hooks/use-sse";
import { inventoryApi, itemsApi, locationsApi, containersApi, importExportApi } from "@/lib/api";
import type { Inventory, InventoryCreate, InventoryCondition, InventoryStatus } from "@/lib/types/inventory";
import type { Item } from "@/lib/types/items";
import type { Location } from "@/lib/types/locations";
import type { Container } from "@/lib/types/containers";
import { cn } from "@/lib/utils";
import { exportToCSV, generateFilename, type ColumnDefinition } from "@/lib/utils/csv-export";

const CONDITION_OPTIONS: { value: InventoryCondition; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "FOR_REPAIR", label: "For Repair" },
];

const STATUS_OPTIONS: {
  value: InventoryStatus;
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "AVAILABLE", label: "Available", color: "bg-green-500", icon: CheckCircle },
  { value: "IN_USE", label: "In Use", color: "bg-blue-500", icon: Package },
  { value: "RESERVED", label: "Reserved", color: "bg-yellow-500", icon: CheckCircle2 },
  { value: "ON_LOAN", label: "On Loan", color: "bg-purple-500", icon: HandCoins },
  { value: "IN_TRANSIT", label: "In Transit", color: "bg-orange-500", icon: Move },
  { value: "DISPOSED", label: "Disposed", color: "bg-gray-500", icon: Archive },
  { value: "MISSING", label: "Missing", color: "bg-red-500", icon: AlertCircle },
];

interface InventoryFilterControlsProps {
  locations: Location[];
  containers: Container[];
  addFilter: (filter: any) => void;
  getFilter: (key: string) => any;
}

function InventoryFilterControls({
  locations,
  containers,
  addFilter,
  getFilter,
}: InventoryFilterControlsProps) {
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedContainers, setSelectedContainers] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<InventoryCondition[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<InventoryStatus[]>([]);
  const [minQuantity, setMinQuantity] = useState<string>("");
  const [maxQuantity, setMaxQuantity] = useState<string>("");

  // Toggle location selection
  const toggleLocation = (locationId: string) => {
    const newSelection = selectedLocations.includes(locationId)
      ? selectedLocations.filter((id) => id !== locationId)
      : [...selectedLocations, locationId];

    setSelectedLocations(newSelection);

    if (newSelection.length > 0) {
      addFilter({
        key: "locations",
        label: "Location",
        value: newSelection,
        type: "multi-select",
      });
    } else {
      addFilter({
        key: "locations",
        label: "Location",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Toggle container selection
  const toggleContainer = (containerId: string) => {
    const newSelection = selectedContainers.includes(containerId)
      ? selectedContainers.filter((id) => id !== containerId)
      : [...selectedContainers, containerId];

    setSelectedContainers(newSelection);

    if (newSelection.length > 0) {
      addFilter({
        key: "containers",
        label: "Container",
        value: newSelection,
        type: "multi-select",
      });
    } else {
      addFilter({
        key: "containers",
        label: "Container",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Toggle condition selection
  const toggleCondition = (condition: InventoryCondition) => {
    const newSelection = selectedConditions.includes(condition)
      ? selectedConditions.filter((c) => c !== condition)
      : [...selectedConditions, condition];

    setSelectedConditions(newSelection);

    if (newSelection.length > 0) {
      addFilter({
        key: "conditions",
        label: "Condition",
        value: newSelection,
        type: "multi-select",
      });
    } else {
      addFilter({
        key: "conditions",
        label: "Condition",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Toggle status selection
  const toggleStatus = (status: InventoryStatus) => {
    const newSelection = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];

    setSelectedStatuses(newSelection);

    if (newSelection.length > 0) {
      addFilter({
        key: "statuses",
        label: "Status",
        value: newSelection,
        type: "multi-select",
      });
    } else {
      addFilter({
        key: "statuses",
        label: "Status",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Update quantity range
  const updateQuantityRange = () => {
    const min = minQuantity ? parseInt(minQuantity, 10) : null;
    const max = maxQuantity ? parseInt(maxQuantity, 10) : null;

    if (min !== null || max !== null) {
      addFilter({
        key: "quantity",
        label: "Quantity",
        value: { min, max },
        type: "number-range",
      });
    } else {
      addFilter({
        key: "quantity",
        label: "Quantity",
        value: [],
        type: "multi-select",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Locations */}
      {locations.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Locations</Label>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
            {locations.map((location) => (
              <div key={location.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`location-${location.id}`}
                  checked={selectedLocations.includes(location.id)}
                  onCheckedChange={() => toggleLocation(location.id)}
                />
                <label
                  htmlFor={`location-${location.id}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  {location.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Containers */}
      {containers.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Containers</Label>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
            {containers.map((container) => (
              <div key={container.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`container-${container.id}`}
                  checked={selectedContainers.includes(container.id)}
                  onCheckedChange={() => toggleContainer(container.id)}
                />
                <label
                  htmlFor={`container-${container.id}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  {container.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conditions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Condition</Label>
        <div className="space-y-2 rounded-md border p-2">
          {CONDITION_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`condition-${option.value}`}
                checked={selectedConditions.includes(option.value)}
                onCheckedChange={() => toggleCondition(option.value)}
              />
              <label
                htmlFor={`condition-${option.value}`}
                className="flex-1 cursor-pointer text-sm"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Statuses */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Status</Label>
        <div className="space-y-2 rounded-md border p-2">
          {STATUS_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${option.value}`}
                checked={selectedStatuses.includes(option.value)}
                onCheckedChange={() => toggleStatus(option.value)}
              />
              <label
                htmlFor={`status-${option.value}`}
                className="flex-1 cursor-pointer text-sm"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Quantity Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Quantity Range</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            onBlur={updateQuantityRange}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="number"
            placeholder="Max"
            value={maxQuantity}
            onChange={(e) => setMaxQuantity(e.target.value)}
            onBlur={updateQuantityRange}
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
}

function InventoryTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: InventoryStatus }) {
  const statusOption = STATUS_OPTIONS.find(s => s.value === status);
  const Icon = statusOption?.icon;

  return (
    <Badge className={cn("gap-1.5", statusOption?.color)}>
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      <span>{statusOption?.label || status}</span>
    </Badge>
  );
}

export default function InventoryPage() {
  const t = useTranslations("inventory");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [showArchived, setShowArchived] = useState(false);

  // Virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null);

  // Enhanced filters
  const {
    filterChips,
    activeFilters,
    activeFilterCount,
    addFilter,
    removeFilter,
    clearFilters,
    getFilter,
  } = useFilters();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<Inventory | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Form state
  const [formItemId, setFormItemId] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [formContainerId, setFormContainerId] = useState("");
  const [formQuantity, setFormQuantity] = useState(1);
  const [formCondition, setFormCondition] = useState<InventoryCondition>("GOOD");
  const [formStatus, setFormStatus] = useState<InventoryStatus>("AVAILABLE");
  const [formNotes, setFormNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Infinite scroll for inventories
  const {
    items: inventories,
    hasMore,
    isLoading,
    isLoadingMore,
    totalItems,
    loadMore,
    refetch,
  } = useInfiniteScroll({
    fetchFunction: async (page) => {
      if (!workspaceId) {
        return { items: [], total: 0, page: 1, total_pages: 0 };
      }
      return await inventoryApi.list(workspaceId!, { page, limit: 50 });
    },
    pageSize: 50,
    dependencies: [workspaceId],
    autoFetch: !!workspaceId,
  });

  // Load items, locations, and containers
  useEffect(() => {
    if (!workspaceId) return;

    const loadReferenceData = async () => {
      try {
        const [itemsData, locationsData, containersData] = await Promise.all([
          itemsApi.list(workspaceId, { limit: 100 }),
          locationsApi.list(workspaceId, { limit: 100 }),
          containersApi.list(workspaceId, { limit: 100 }),
        ]);
        setItems(itemsData.items.filter(i => !i.is_archived));
        setLocations(locationsData.items.filter(l => !l.is_archived));
        setContainers(containersData.items.filter(c => !c.is_archived));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load data";
        toast.error("Failed to load reference data", {
          description: errorMessage,
        });
      }
    };

    loadReferenceData();
  }, [workspaceId]);

  // Subscribe to SSE events for real-time updates
  useSSE({
    onEvent: (event: SSEEvent) => {
      if (event.entity_type === 'inventory') {
        switch (event.type) {
          case 'inventory.created':
            refetch();
            toast.info('New inventory added');
            break;
          case 'inventory.updated':
            refetch();
            toast.info('Inventory updated');
            break;
          case 'inventory.deleted':
            refetch();
            toast.info('Inventory deleted');
            break;
        }
      }
    }
  });

  // Filter inventories - memoized for performance
  const filteredInventories = useMemo(() => {
    return inventories.filter((inventory) => {
      // Filter by archived status
      if (!showArchived && inventory.is_archived) return false;
      if (showArchived && !inventory.is_archived) return false;

      // Filter by search query
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const item = items.find(i => i.id === inventory.item_id);
        const location = locations.find(l => l.id === inventory.location_id);
        const matchesSearch =
          item?.name.toLowerCase().includes(query) ||
          item?.sku.toLowerCase().includes(query) ||
          location?.name.toLowerCase().includes(query) ||
          inventory.notes?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filter by locations (multi-select)
      const locationsFilter = getFilter("locations");
      if (locationsFilter && Array.isArray(locationsFilter.value)) {
        if (!inventory.location_id || !locationsFilter.value.includes(inventory.location_id)) {
          return false;
        }
      }

      // Filter by containers (multi-select)
      const containersFilter = getFilter("containers");
      if (containersFilter && Array.isArray(containersFilter.value)) {
        if (!inventory.container_id || !containersFilter.value.includes(inventory.container_id)) {
          return false;
        }
      }

      // Filter by conditions (multi-select)
      const conditionsFilter = getFilter("conditions");
      if (conditionsFilter && Array.isArray(conditionsFilter.value)) {
        if (!conditionsFilter.value.includes(inventory.condition)) {
          return false;
        }
      }

      // Filter by statuses (multi-select)
      const statusesFilter = getFilter("statuses");
      if (statusesFilter && Array.isArray(statusesFilter.value)) {
        if (!statusesFilter.value.includes(inventory.status)) {
          return false;
        }
      }

      // Filter by quantity range
      const quantityFilter = getFilter("quantity");
      if (quantityFilter && typeof quantityFilter.value === "object") {
        const range = quantityFilter.value as { min: number | null; max: number | null };
        if (range.min !== null && inventory.quantity < range.min) return false;
        if (range.max !== null && inventory.quantity > range.max) return false;
      }

      return true;
    });
  }, [inventories, showArchived, debouncedSearchQuery, items, locations, activeFilters]);

  // Flatten inventory data for sorting (add item name, location name, container name)
  const flattenedInventories = useMemo(() => {
    return filteredInventories.map(inv => ({
      ...inv,
      item_name: getItemName(inv.item_id),
      item_sku: getItemSKU(inv.item_id),
      location_name: getLocationName(inv.location_id),
      container_name: getContainerName(inv.container_id) || '',
    }));
  }, [filteredInventories, items, locations, containers]);

  // Sort inventories
  const { sortedData: sortedInventories, requestSort, getSortDirection } = useTableSort(flattenedInventories, "item_name", "asc");

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: sortedInventories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 85,
    overscan: 5,
  });

  // Bulk selection
  const {
    selectedIds,
    selectedIdsArray,
    selectedCount,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isSomeSelected,
  } = useBulkSelection<string>();

  // Keyboard shortcuts for this page
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        ctrl: true,
        description: 'Create new inventory',
        action: () => openCreateDialog(),
      },
      {
        key: 'r',
        description: 'Refresh inventory list',
        action: () => refetch(),
        preventDefault: false,
      },
      {
        key: 'a',
        ctrl: true,
        description: 'Select all inventory',
        action: () => {
          if (sortedInventories.length > 0) {
            selectAll(sortedInventories.map((i) => i.id));
          }
        },
      },
      {
        key: 'Escape',
        description: 'Clear selection',
        action: () => {
          if (selectedCount > 0) {
            clearSelection();
          } else if (dialogOpen) {
            setDialogOpen(false);
          }
        },
        preventDefault: false,
      },
      {
        key: 'e',
        ctrl: true,
        description: 'Export selected inventory',
        action: () => {
          if (selectedCount > 0) {
            handleBulkExport();
          }
        },
      },
    ],
    enabled: true,
    ignoreInputFields: true,
  });

  const getItemName = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    return item?.name || "Unknown Item";
  };

  const getItemSKU = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    return item?.sku || "";
  };

  const getLocationName = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || "Unknown Location";
  };

  const getContainerName = (containerId: string | null | undefined) => {
    if (!containerId) return null;
    const container = containers.find(c => c.id === containerId);
    return container?.name || null;
  };

  // Export columns definition
  const exportColumns: ColumnDefinition<Inventory>[] = useMemo(() => [
    { key: "item_id", label: "Item", formatter: (_, inv) => getItemName(inv.item_id) },
    { key: "item_id", label: "SKU", formatter: (_, inv) => getItemSKU(inv.item_id) },
    { key: "location_id", label: "Location", formatter: (_, inv) => getLocationName(inv.location_id) },
    { key: "container_id", label: "Container", formatter: (_, inv) => getContainerName(inv.container_id) || "-" },
    { key: "quantity", label: "Quantity" },
    { key: "condition", label: "Condition" },
    { key: "status", label: "Status" },
    { key: "unit_price", label: "Unit Price", formatter: (value) => value ? `$${value}` : "-" },
    { key: "total_value", label: "Total Value", formatter: (value) => value ? `$${value}` : "-" },
    { key: "notes", label: "Notes" },
    { key: "created_at", label: "Created Date", formatter: (value) => new Date(value).toLocaleDateString() },
    { key: "updated_at", label: "Updated Date", formatter: (value) => new Date(value).toLocaleDateString() },
  ], [items, locations, containers]);

  const openCreateDialog = () => {
    setEditingInventory(null);
    setFormItemId("");
    setFormLocationId("");
    setFormContainerId("");
    setFormQuantity(1);
    setFormCondition("GOOD");
    setFormStatus("AVAILABLE");
    setFormNotes("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!workspaceId) return;

    if (!formItemId || !formLocationId || formQuantity < 1) {
      toast.error("Please fill in required fields", {
        description: "Item, Location, and Quantity (≥1) are required",
      });
      return;
    }

    try {
      setIsSaving(true);

      const createData: InventoryCreate = {
        item_id: formItemId,
        location_id: formLocationId,
        container_id: formContainerId || undefined,
        quantity: formQuantity,
        condition: formCondition,
        status: formStatus,
        notes: formNotes || undefined,
      };
      await inventoryApi.create(workspaceId!, createData);
      toast.success("Inventory created successfully");

      setDialogOpen(false);
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save inventory";
      toast.error("Failed to save inventory", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (inventory: Inventory) => {
    try {
      if (inventory.is_archived) {
        await inventoryApi.restore(workspaceId!, inventory.id);
        toast.success("Inventory restored successfully");
      } else {
        await inventoryApi.archive(workspaceId!, inventory.id);
        toast.success("Inventory archived successfully");
      }
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to archive inventory";
      toast.error("Failed to archive inventory", {
        description: errorMessage,
      });
    }
  };

  // Inline edit handlers
  const handleUpdateQuantity = async (inventoryId: string, value: string) => {
    const quantity = parseInt(value, 10);
    if (isNaN(quantity) || quantity < 0) {
      throw new Error("Quantity must be a positive number");
    }
    try {
      await inventoryApi.updateQuantity(workspaceId!, inventoryId, { quantity });
      toast.success("Quantity updated");
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update quantity";
      toast.error("Update failed", { description: errorMessage });
      throw error;
    }
  };

  const handleUpdateCondition = async (inventoryId: string, condition: string) => {
    // Find the current inventory to get required fields
    const currentInventory = inventories.find((inv) => inv.id === inventoryId);
    if (!currentInventory) {
      throw new Error("Inventory not found");
    }

    try {
      await inventoryApi.update(workspaceId!, inventoryId, {
        location_id: currentInventory.location_id,
        container_id: currentInventory.container_id || undefined,
        quantity: currentInventory.quantity,
        condition: condition as InventoryCondition,
        date_acquired: currentInventory.date_acquired || undefined,
        purchase_price: currentInventory.purchase_price || undefined,
        currency_code: currentInventory.currency_code || undefined,
        warranty_expires: currentInventory.warranty_expires || undefined,
        expiration_date: currentInventory.expiration_date || undefined,
        notes: currentInventory.notes || undefined,
      });
      toast.success("Condition updated");
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update condition";
      toast.error("Update failed", { description: errorMessage });
      throw error;
    }
  };

  const handleUpdateStatus = async (inventoryId: string, status: string) => {
    try {
      await inventoryApi.updateStatus(workspaceId!, inventoryId, { status: status as InventoryStatus });
      toast.success("Status updated");
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update status";
      toast.error("Update failed", { description: errorMessage });
      throw error;
    }
  };

  // Bulk export selected inventory to CSV
  const handleBulkExport = () => {
    const selectedInventories = sortedInventories.filter((inv) => selectedIds.has(inv.id));
    exportToCSV(selectedInventories, exportColumns, generateFilename("inventory-bulk"));
    toast.success(`Exported ${selectedCount} ${selectedCount === 1 ? "entry" : "entries"}`);
    clearSelection();
  };

  // Bulk update status for selected inventory
  const handleBulkStatusUpdate = async (newStatus: InventoryStatus) => {
    if (selectedCount === 0) return;

    try {
      // Update all selected inventories
      await Promise.all(
        selectedIdsArray.map((id) => {
          return inventoryApi.updateStatus(workspaceId!, id, { status: newStatus });
        })
      );

      toast.success(
        `Updated ${selectedCount} ${selectedCount === 1 ? "entry" : "entries"} to ${newStatus}`
      );
      clearSelection();
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update inventory";
      toast.error("Failed to update inventory", {
        description: errorMessage,
      });
    }
  };

  // Import inventory from CSV
  const handleImport = async (file: File): Promise<ImportResult> => {
    if (!workspaceId) {
      throw new Error("No workspace selected");
    }

    try {
      const result = await importExportApi.import(workspaceId, "inventory", file);

      // Refresh the inventory list after successful import
      if (result.successful_imports > 0) {
        refetch();
      }

      return {
        success: result.successful_imports,
        failed: result.failed_imports,
        errors: result.errors.map((e) => ({
          row: e.row_number,
          message: e.error,
        })),
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Import failed");
    }
  };

  if (workspaceLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <InventoryTableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">
          Track physical instances of items at specific locations
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inventory Tracking</CardTitle>
              <CardDescription>
                {sortedInventories.length} inventor{sortedInventories.length !== 1 ? "ies" : "y"}
                {searchQuery && " matching your search"}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Inventory
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by item, SKU, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <FilterPopover activeFilterCount={activeFilterCount}>
                <InventoryFilterControls
                  locations={locations}
                  containers={containers}
                  addFilter={addFilter}
                  getFilter={getFilter}
                />
              </FilterPopover>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportDialogOpen(true)}
                disabled={filteredInventories.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                <Archive className="mr-2 h-4 w-4" />
                {showArchived ? "Archived" : "Active"}
              </Button>
            </div>

            {/* Filter chips */}
            {filterChips.length > 0 && (
              <FilterBar
                filterChips={filterChips}
                onRemoveFilter={removeFilter}
                onClearAll={clearFilters}
              />
            )}

            {/* Inventory table */}
            {sortedInventories.length === 0 ? (
              <EmptyState
                icon={Package}
                title={
                  searchQuery || activeFilterCount > 0
                    ? "No inventory found"
                    : showArchived
                    ? "No archived inventory"
                    : "No inventory yet"
                }
                description={
                  searchQuery || activeFilterCount > 0
                    ? "Try adjusting your search or filters"
                    : showArchived
                    ? "Archived inventory will appear here"
                    : "Start tracking physical items at locations"
                }
              >
                {!searchQuery && activeFilterCount === 0 && !showArchived && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Inventory
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <Table aria-label="Inventory items">
                    <caption className="sr-only">
                      List of inventory items with quantity, location, condition, and status information.
                      Currently showing {sortedInventories.length} {sortedInventories.length === 1 ? "entry" : "entries"}.
                    </caption>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={isAllSelected(sortedInventories.map((i) => i.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                selectAll(sortedInventories.map((i) => i.id));
                              } else {
                                clearSelection();
                              }
                            }}
                            aria-label="Select all inventory"
                          />
                        </TableHead>
                        <SortableTableHead
                          sortDirection={getSortDirection("item_name")}
                          onSort={() => requestSort("item_name")}
                        >
                          Item
                        </SortableTableHead>
                        <SortableTableHead
                          sortDirection={getSortDirection("location_name")}
                          onSort={() => requestSort("location_name")}
                        >
                          Location
                        </SortableTableHead>
                        <SortableTableHead
                          sortDirection={getSortDirection("quantity")}
                          onSort={() => requestSort("quantity")}
                        >
                          Qty
                        </SortableTableHead>
                        <SortableTableHead
                          sortDirection={getSortDirection("condition")}
                          onSort={() => requestSort("condition")}
                        >
                          Condition
                        </SortableTableHead>
                        <SortableTableHead
                          sortDirection={getSortDirection("status")}
                          onSort={() => requestSort("status")}
                        >
                          Status
                        </SortableTableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                  </Table>
                </div>

                {/* Virtual Scrolling Container */}
                <div
                  ref={parentRef}
                  className="overflow-auto"
                  style={{ height: '600px' }}
                >
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    <Table>
                      <TableBody>
                        {virtualizer.getVirtualItems().map((virtualItem) => {
                          const inventory = sortedInventories[virtualItem.index];
                          return (
                            <TableRow
                              key={inventory.id}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`,
                              }}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={isSelected(inventory.id)}
                                  onCheckedChange={() => toggleSelection(inventory.id)}
                                  aria-label={`Select ${getItemName(inventory.item_id)}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{getItemName(inventory.item_id)}</div>
                                  <div className="text-sm text-muted-foreground font-mono">
                                    {getItemSKU(inventory.item_id)}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div>{getLocationName(inventory.location_id)}</div>
                                    {inventory.container_id && (
                                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Box className="h-3 w-3" />
                                        {getContainerName(inventory.container_id)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <InlineEditCell
                                  value={inventory.quantity.toString()}
                                  onSave={(newValue) =>
                                    handleUpdateQuantity(inventory.id, newValue)
                                  }
                                  type="number"
                                  placeholder="0"
                                  className="font-medium"
                                />
                              </TableCell>
                              <TableCell>
                                <InlineEditSelect
                                  value={inventory.condition}
                                  options={CONDITION_OPTIONS}
                                  onSave={(newValue) =>
                                    handleUpdateCondition(inventory.id, newValue)
                                  }
                                  renderValue={(value, option) => (
                                    <Badge variant="outline">{option?.label || value}</Badge>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <InlineEditSelect
                                  value={inventory.status}
                                  options={STATUS_OPTIONS}
                                  onSave={(newValue) =>
                                    handleUpdateStatus(inventory.id, newValue)
                                  }
                                  renderValue={(value) => <StatusBadge status={value as InventoryStatus} />}
                                />
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label={`Actions for ${getItemName(inventory.item_id)}`}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => toast.info("Edit functionality coming soon")}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toast.info("Move functionality coming soon")}>
                                      <Move className="mr-2 h-4 w-4" />
                                      Move
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleArchive(inventory)}>
                                      {inventory.is_archived ? (
                                        <>
                                          <ArchiveRestore className="mr-2 h-4 w-4" />
                                          Restore
                                        </>
                                      ) : (
                                        <>
                                          <Archive className="mr-2 h-4 w-4" />
                                          Archive
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* Infinite scroll trigger */}
            <InfiniteScrollTrigger
              onLoadMore={loadMore}
              isLoading={isLoadingMore}
              hasMore={hasMore}
              loadingText="Loading more inventory..."
              endText={`Showing all ${sortedInventories.length} inventor${sortedInventories.length !== 1 ? "ies" : "y"}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Inventory</DialogTitle>
            <DialogDescription>
              Track a physical instance of an item at a location
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item">
                  Item <span className="text-destructive">*</span>
                </Label>
                <Select value={formItemId} onValueChange={setFormItemId} required>
                  <SelectTrigger id="item" aria-required="true">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">
                  Location <span className="text-destructive">*</span>
                </Label>
                <Select value={formLocationId} onValueChange={setFormLocationId} required>
                  <SelectTrigger id="location" aria-required="true">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="container">Container</Label>
                <Select value={formContainerId || "none"} onValueChange={(value) => setFormContainerId(value === "none" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {containers
                      .filter(c => !formLocationId || c.location_id === formLocationId)
                      .map((container) => (
                        <SelectItem key={container.id} value={container.id}>
                          {container.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select value={formCondition} onValueChange={(v) => setFormCondition(v as InventoryCondition)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as InventoryStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Additional information..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Bar */}
      <BulkActionBar selectedCount={selectedCount} onClear={clearSelection}>
        <Button onClick={handleBulkExport} size="sm" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <CheckCircle className="mr-2 h-4 w-4" />
              Update Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleBulkStatusUpdate("AVAILABLE")}>
              Set as Available
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkStatusUpdate("IN_USE")}>
              Set as In Use
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkStatusUpdate("RESERVED")}>
              Set as Reserved
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkStatusUpdate("ON_LOAN")}>
              Set as On Loan
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkStatusUpdate("IN_TRANSIT")}>
              Set as In Transit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </BulkActionBar>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        data={sortedInventories}
        allData={inventories}
        columns={exportColumns}
        filePrefix="inventory"
        title="Export Inventory to CSV"
        description="Select columns and data to export"
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="inventory"
        onImport={handleImport}
        title="Import Inventory from CSV"
        description="Upload a CSV file to import inventory entries"
      />
    </div>
  );
}
