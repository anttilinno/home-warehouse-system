"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  CheckCircle,
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
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { inventoryApi, itemsApi, locationsApi, containersApi } from "@/lib/api";
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

const STATUS_OPTIONS: { value: InventoryStatus; label: string; color: string }[] = [
  { value: "AVAILABLE", label: "Available", color: "bg-green-500" },
  { value: "IN_USE", label: "In Use", color: "bg-blue-500" },
  { value: "RESERVED", label: "Reserved", color: "bg-yellow-500" },
  { value: "ON_LOAN", label: "On Loan", color: "bg-purple-500" },
  { value: "IN_TRANSIT", label: "In Transit", color: "bg-orange-500" },
  { value: "DISPOSED", label: "Disposed", color: "bg-gray-500" },
  { value: "MISSING", label: "Missing", color: "bg-red-500" },
];

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
  return (
    <Badge className={cn("gap-1", statusOption?.color)}>
      {statusOption?.label || status}
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<Inventory | null>(null);

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
      return await inventoryApi.list({ page, limit: 50 });
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
          itemsApi.list({ limit: 500 }),
          locationsApi.list({ limit: 500 }),
          containersApi.list({ limit: 500 }),
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

  // Filter inventories
  const filteredInventories = inventories.filter((inventory) => {
    // Filter by archived status
    if (!showArchived && inventory.is_archived) return false;
    if (showArchived && !inventory.is_archived) return false;

    // Filter by status
    if (statusFilter !== "all" && inventory.status !== statusFilter) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const item = items.find(i => i.id === inventory.item_id);
      const location = locations.find(l => l.id === inventory.location_id);
      const matchesSearch =
        item?.name.toLowerCase().includes(query) ||
        item?.sku.toLowerCase().includes(query) ||
        location?.name.toLowerCase().includes(query) ||
        inventory.notes?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Sort inventories
  const { sortedData: sortedInventories, requestSort, getSortDirection } = useTableSort(filteredInventories, "item_id", "asc");

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
      await inventoryApi.create(createData);
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
        await inventoryApi.restore(inventory.id);
        toast.success("Inventory restored successfully");
      } else {
        await inventoryApi.archive(inventory.id);
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

  // Bulk export selected inventory to CSV
  const handleBulkExport = () => {
    const selectedInventories = sortedInventories.filter((inv) => selectedIds.has(inv.id));

    const columns: ColumnDefinition<Inventory>[] = [
      { key: "item_id", label: "Item", formatter: (_, inv) => getItemName(inv.item_id) },
      { key: "location_id", label: "Location", formatter: (_, inv) => getLocationName(inv.location_id) },
      { key: "container_id", label: "Container", formatter: (_, inv) => getContainerName(inv.container_id) || "-" },
      { key: "quantity", label: "Quantity" },
      { key: "condition", label: "Condition" },
      { key: "status", label: "Status" },
      { key: "notes", label: "Notes" },
      {
        key: "date_acquired",
        label: "Date Acquired",
        formatter: (value) => value ? format(parseISO(value), "yyyy-MM-dd") : "-"
      },
    ];

    exportToCSV(selectedInventories, columns, generateFilename("inventory"));
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
          return inventoryApi.updateStatus(id, { status: newStatus });
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
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                <Archive className="mr-2 h-4 w-4" />
                {showArchived ? "Archived" : "Active"}
              </Button>
            </div>

            {/* Inventory table */}
            {sortedInventories.length === 0 ? (
              <EmptyState
                icon={Package}
                title={
                  searchQuery || statusFilter !== "all"
                    ? "No inventory found"
                    : showArchived
                    ? "No archived inventory"
                    : "No inventory yet"
                }
                description={
                  searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : showArchived
                    ? "Archived inventory will appear here"
                    : "Start tracking physical items at locations"
                }
              >
                {!searchQuery && statusFilter === "all" && !showArchived && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Inventory
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
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
                        sortDirection={getSortDirection("item_id")}
                        onSort={() => requestSort("item_id")}
                      >
                        Item
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("location_id")}
                        onSort={() => requestSort("location_id")}
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
                  <TableBody>
                    {sortedInventories.map((inventory) => (
                      <TableRow key={inventory.id}>
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
                        <TableCell>{inventory.quantity}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {CONDITION_OPTIONS.find(c => c.value === inventory.condition)?.label || inventory.condition}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={inventory.status} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
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
                    ))}
                  </TableBody>
                </Table>
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
                <Select value={formItemId} onValueChange={setFormItemId}>
                  <SelectTrigger>
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
                <Select value={formLocationId} onValueChange={setFormLocationId}>
                  <SelectTrigger>
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
                <Select value={formContainerId} onValueChange={setFormContainerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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
    </div>
  );
}
