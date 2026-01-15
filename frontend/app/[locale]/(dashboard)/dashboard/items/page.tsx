"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Package,
  Filter,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, EmptyStateList, EmptyStateBenefits } from "@/components/ui/empty-state";
import { InfiniteScrollTrigger } from "@/components/ui/infinite-scroll-trigger";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import { itemsApi, categoriesApi, type Category } from "@/lib/api";
import type { Item, ItemCreate, ItemUpdate } from "@/lib/types/items";
import { cn } from "@/lib/utils";

interface ItemFormData {
  sku: string;
  name: string;
  description: string;
  category_id: string;
  brand: string;
  model: string;
  serial_number: string;
  manufacturer: string;
  barcode: string;
  is_insured: boolean;
  lifetime_warranty: boolean;
  warranty_details: string;
  min_stock_level: number;
  short_code: string;
}

function ItemsTableSkeleton() {
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
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Stock Level</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function ItemsPage() {
  const t = useTranslations("items");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

  // Form state
  const [formData, setFormData] = useState<ItemFormData>({
    sku: "",
    name: "",
    description: "",
    category_id: "",
    brand: "",
    model: "",
    serial_number: "",
    manufacturer: "",
    barcode: "",
    is_insured: false,
    lifetime_warranty: false,
    warranty_details: "",
    min_stock_level: 0,
    short_code: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load categories
  const loadCategories = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const data = await categoriesApi.list(workspaceId);
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      loadCategories();
    }
  }, [workspaceId, loadCategories]);

  // Infinite scroll for items
  const {
    items,
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
      return await itemsApi.list({ page, limit: 50 });
    },
    pageSize: 50,
    dependencies: [workspaceId],
    autoFetch: !!workspaceId,
  });

  // Filter items (client-side)
  const filteredItems = items.filter((item) => {
    // Filter by archived status
    if (!showArchived && item.is_archived) return false;
    if (showArchived && !item.is_archived) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        item.sku.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query) ||
        item.model?.toLowerCase().includes(query) ||
        item.manufacturer?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Filter by category
    if (categoryFilter && item.category_id !== categoryFilter) return false;

    return true;
  });

  // Sort items (client-side)
  const { sortedData: sortedItems, requestSort, getSortDirection } = useTableSort(filteredItems, "name", "asc");

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return "-";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "-";
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({
      sku: "",
      name: "",
      description: "",
      category_id: "",
      brand: "",
      model: "",
      serial_number: "",
      manufacturer: "",
      barcode: "",
      is_insured: false,
      lifetime_warranty: false,
      warranty_details: "",
      min_stock_level: 0,
      short_code: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    setFormData({
      sku: item.sku,
      name: item.name,
      description: item.description || "",
      category_id: item.category_id || "",
      brand: item.brand || "",
      model: item.model || "",
      serial_number: item.serial_number || "",
      manufacturer: item.manufacturer || "",
      barcode: item.barcode || "",
      is_insured: item.is_insured || false,
      lifetime_warranty: item.lifetime_warranty || false,
      warranty_details: item.warranty_details || "",
      min_stock_level: item.min_stock_level,
      short_code: item.short_code || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!workspaceId) return;

    if (!formData.sku.trim() || !formData.name.trim()) {
      toast.error("Please fill in required fields", {
        description: "SKU and Name are required",
      });
      return;
    }

    try {
      setIsSaving(true);

      if (editingItem) {
        // Update existing item
        const updateData: ItemUpdate = {
          name: formData.name,
          description: formData.description || undefined,
          category_id: formData.category_id || undefined,
          brand: formData.brand || undefined,
          model: formData.model || undefined,
          serial_number: formData.serial_number || undefined,
          manufacturer: formData.manufacturer || undefined,
          barcode: formData.barcode || undefined,
          is_insured: formData.is_insured,
          lifetime_warranty: formData.lifetime_warranty,
          warranty_details: formData.warranty_details || undefined,
          min_stock_level: formData.min_stock_level,
        };
        await itemsApi.update(editingItem.id, updateData);
        toast.success("Item updated successfully");
      } else {
        // Create new item
        const createData: ItemCreate = {
          sku: formData.sku,
          name: formData.name,
          description: formData.description || undefined,
          category_id: formData.category_id || undefined,
          brand: formData.brand || undefined,
          model: formData.model || undefined,
          serial_number: formData.serial_number || undefined,
          manufacturer: formData.manufacturer || undefined,
          barcode: formData.barcode || undefined,
          is_insured: formData.is_insured,
          lifetime_warranty: formData.lifetime_warranty,
          warranty_details: formData.warranty_details || undefined,
          min_stock_level: formData.min_stock_level,
          short_code: formData.short_code || undefined,
        };
        await itemsApi.create(createData);
        toast.success("Item created successfully");
      }

      setDialogOpen(false);
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save item";
      toast.error("Failed to save item", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (item: Item) => {
    try {
      if (item.is_archived) {
        await itemsApi.restore(item.id);
        toast.success("Item restored successfully");
      } else {
        await itemsApi.archive(item.id);
        toast.success("Item archived successfully");
      }
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to archive item";
      toast.error("Failed to archive item", {
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
        <ItemsTableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Items</h1>
        <p className="text-muted-foreground">
          Manage your item catalog with SKUs, categories, and attributes
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Item Catalog</CardTitle>
              <CardDescription>
                {totalItems} item{totalItems !== 1 ? "s" : ""}
                {searchQuery && " matching your search"}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
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
                  placeholder="Search by SKU, name, brand, or model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={categoryFilter || "all"}
                onValueChange={(value) => setCategoryFilter(value === "all" ? null : value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
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

            {/* Items table */}
            {totalItems === 0 ? (
              <EmptyState
                icon={Package}
                title={
                  searchQuery || categoryFilter
                    ? "No items found"
                    : showArchived
                    ? "No archived items"
                    : "No items yet"
                }
                description={
                  searchQuery || categoryFilter
                    ? "Try adjusting your search or filters"
                    : showArchived
                    ? "Archived items will appear here"
                    : "Get started by creating your first item"
                }
              >
                {!searchQuery && !categoryFilter && !showArchived && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Item
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        sortDirection={getSortDirection("sku")}
                        onSort={() => requestSort("sku")}
                      >
                        SKU
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("name")}
                        onSort={() => requestSort("name")}
                      >
                        Name
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("category_id")}
                        onSort={() => requestSort("category_id")}
                      >
                        Category
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("brand")}
                        onSort={() => requestSort("brand")}
                      >
                        Brand
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("model")}
                        onSort={() => requestSort("model")}
                      >
                        Model
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("min_stock_level")}
                        onSort={() => requestSort("min_stock_level")}
                      >
                        Min Stock
                      </SortableTableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          {item.sku}
                          {item.short_code && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {item.short_code}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            {item.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getCategoryName(item.category_id)}</TableCell>
                        <TableCell>{item.brand || "-"}</TableCell>
                        <TableCell>{item.model || "-"}</TableCell>
                        <TableCell>{item.min_stock_level}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(item)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleArchive(item)}>
                                {item.is_archived ? (
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

                {/* Infinite Scroll Trigger */}
                <InfiniteScrollTrigger
                  onLoadMore={loadMore}
                  isLoading={isLoadingMore}
                  hasMore={hasMore}
                  loadingText="Loading more items..."
                  endText={`Showing all ${totalItems} items`}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Create New Item"}</DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the item details below"
                : "Add a new item to your catalog"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">
                    SKU <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    disabled={!!editingItem}
                    placeholder="ITEM-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="short_code">Short Code</Label>
                  <Input
                    id="short_code"
                    value={formData.short_code}
                    onChange={(e) => setFormData({ ...formData, short_code: e.target.value })}
                    placeholder="QR code label"
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Item name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this item..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Product Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Brand name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Model number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturer: e.target.value })
                    }
                    placeholder="Manufacturer name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) =>
                      setFormData({ ...formData, serial_number: e.target.value })
                    }
                    placeholder="Serial number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Barcode or UPC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_stock_level">Minimum Stock Level</Label>
                  <Input
                    id="min_stock_level"
                    type="number"
                    min="0"
                    value={formData.min_stock_level}
                    onChange={(e) =>
                      setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Warranty & Insurance */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Warranty & Insurance</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_insured"
                    checked={formData.is_insured}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_insured: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_insured" className="font-normal cursor-pointer">
                    Item is insured
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lifetime_warranty"
                    checked={formData.lifetime_warranty}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, lifetime_warranty: checked as boolean })
                    }
                  />
                  <Label htmlFor="lifetime_warranty" className="font-normal cursor-pointer">
                    Lifetime warranty
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warranty_details">Warranty Details</Label>
                  <Textarea
                    id="warranty_details"
                    value={formData.warranty_details}
                    onChange={(e) =>
                      setFormData({ ...formData, warranty_details: e.target.value })
                    }
                    placeholder="Warranty information..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
