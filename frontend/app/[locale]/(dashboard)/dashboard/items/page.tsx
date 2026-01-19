"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
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
  Download,
  Upload,
  Archive as ArchiveIcon,
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
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterPopover } from "@/components/ui/filter-popover";
import { ExportDialog } from "@/components/ui/export-dialog";
import { ImportDialog, type ImportResult } from "@/components/ui/import-dialog";
import { SavedFilters } from "@/components/ui/saved-filters";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useFilters } from "@/lib/hooks/use-filters";
import { useSavedFilters } from "@/lib/hooks/use-saved-filters";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { useSSE, type SSEEvent } from "@/lib/hooks/use-sse";
import { itemsApi, categoriesApi, importExportApi, type Category } from "@/lib/api";
import type { Item, ItemCreate, ItemUpdate } from "@/lib/types/items";
import { PhotoPlaceholder } from "@/components/items/photo-placeholder";
import { cn } from "@/lib/utils";
import { exportToCSV, generateFilename, type ColumnDefinition } from "@/lib/utils/csv-export";

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

interface ItemsFilterControlsProps {
  categories: Category[];
  uniqueBrands: string[];
  addFilter: (filter: any) => void;
  getFilter: (key: string) => any;
}

function ItemsFilterControls({
  categories,
  uniqueBrands,
  addFilter,
  getFilter,
}: ItemsFilterControlsProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [hasWarranty, setHasWarranty] = useState<boolean | null>(null);
  const [isInsured, setIsInsured] = useState<boolean | null>(null);

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    const newSelection = selectedCategories.includes(categoryId)
      ? selectedCategories.filter((id) => id !== categoryId)
      : [...selectedCategories, categoryId];

    setSelectedCategories(newSelection);

    if (newSelection.length > 0) {
      addFilter({
        key: "categories",
        label: "Category",
        value: newSelection,
        type: "multi-select",
      });
    } else {
      addFilter({
        key: "categories",
        label: "Category",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Toggle brand selection
  const toggleBrand = (brand: string) => {
    const newSelection = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand];

    setSelectedBrands(newSelection);

    if (newSelection.length > 0) {
      addFilter({
        key: "brands",
        label: "Brand",
        value: newSelection,
        type: "multi-select",
      });
    } else {
      addFilter({
        key: "brands",
        label: "Brand",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Update warranty filter
  const updateWarrantyFilter = (value: boolean | null) => {
    setHasWarranty(value);
    if (value !== null) {
      addFilter({
        key: "warranty",
        label: "Warranty",
        value: value,
        type: "boolean",
      });
    } else {
      addFilter({
        key: "warranty",
        label: "Warranty",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Update insurance filter
  const updateInsuranceFilter = (value: boolean | null) => {
    setIsInsured(value);
    if (value !== null) {
      addFilter({
        key: "insurance",
        label: "Insurance",
        value: value,
        type: "boolean",
      });
    } else {
      addFilter({
        key: "insurance",
        label: "Insurance",
        value: [],
        type: "multi-select",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Categories */}
      {categories.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Categories</Label>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={() => toggleCategory(category.id)}
                />
                <label
                  htmlFor={`category-${category.id}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  {category.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Brands */}
      {uniqueBrands.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Brands</Label>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
            {uniqueBrands.map((brand) => (
              <div key={brand} className="flex items-center space-x-2">
                <Checkbox
                  id={`brand-${brand}`}
                  checked={selectedBrands.includes(brand)}
                  onCheckedChange={() => toggleBrand(brand)}
                />
                <label
                  htmlFor={`brand-${brand}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  {brand}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warranty */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Warranty</Label>
        <Select
          value={hasWarranty === null ? "all" : hasWarranty ? "yes" : "no"}
          onValueChange={(value) => {
            if (value === "all") updateWarrantyFilter(null);
            else if (value === "yes") updateWarrantyFilter(true);
            else updateWarrantyFilter(false);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Has Warranty</SelectItem>
            <SelectItem value="no">No Warranty</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Insurance */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Insurance</Label>
        <Select
          value={isInsured === null ? "all" : isInsured ? "yes" : "no"}
          onValueChange={(value) => {
            if (value === "all") updateInsuranceFilter(null);
            else if (value === "yes") updateInsuranceFilter(true);
            else updateInsuranceFilter(false);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Is Insured</SelectItem>
            <SelectItem value="no">Not Insured</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
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
              <TableHead>Photo</TableHead>
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
                <TableCell><Skeleton className="h-12 w-12 rounded-md" /></TableCell>
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
  const router = useRouter();
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [showArchived, setShowArchived] = useState(false);
  const [itemPhotos, setItemPhotos] = useState<Record<string, { urls: { small: string; medium: string; original: string; large: string } } | null>>({});
  const [photoCount, setPhotoCount] = useState<Record<string, number>>({});

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

  // Saved filters
  const getCurrentFilters = () => {
    const filters: Record<string, any> = {};
    activeFilters.forEach((filter) => {
      filters[filter.key] = filter.value;
    });
    if (searchQuery) {
      filters.search = searchQuery;
    }
    if (showArchived) {
      filters.showArchived = true;
    }
    return filters;
  };

  const applyFilters = (filters: Record<string, any>) => {
    // Clear existing filters
    clearFilters();

    // Apply search
    if (filters.search) {
      setSearchQuery(filters.search);
    } else {
      setSearchQuery("");
    }

    // Apply archived toggle
    if (filters.showArchived !== undefined) {
      setShowArchived(filters.showArchived);
    }

    // Apply all other filters
    Object.entries(filters).forEach(([key, value]) => {
      if (key !== "search" && key !== "showArchived") {
        addFilter({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          value,
          type: Array.isArray(value) ? "multi-select" : typeof value === "boolean" ? "boolean" : "text",
        });
      }
    });
  };

  const {
    savedFilters,
    saveFilter,
    deleteFilter,
    applyFilter: applySavedFilter,
    setAsDefault,
  } = useSavedFilters({
    storageKey: "items-saved-filters",
    onApplyFilter: applyFilters,
  });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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

  // Load primary photos for visible items
  const loadItemPhotos = useCallback(async (itemIds: string[]) => {
    if (!workspaceId || itemIds.length === 0) return;

    try {
      // Fetch primary photos for each item
      const photoPromises = itemIds.map(async (itemId) => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/items/${itemId}/photos/list`,
            {
              credentials: "include",
            }
          );
          if (response.ok) {
            const data = await response.json();
            // Find primary photo or use first one
            const photos = data.items || [];
            const primaryPhoto = photos.find((p: any) => p.is_primary) || photos[0] || null;
            return { itemId, photo: primaryPhoto, count: photos.length };
          }
          return { itemId, photo: null, count: 0 };
        } catch {
          return { itemId, photo: null, count: 0 };
        }
      });

      const results = await Promise.all(photoPromises);
      const photosMap: Record<string, any> = {};
      const countMap: Record<string, number> = {};
      results.forEach(({ itemId, photo, count }) => {
        photosMap[itemId] = photo;
        countMap[itemId] = count;
      });
      setItemPhotos((prev) => ({ ...prev, ...photosMap }));
      setPhotoCount((prev) => ({ ...prev, ...countMap }));
    } catch (error) {
      console.error("Failed to load item photos:", error);
    }
  }, [workspaceId]);

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
      return await itemsApi.list(workspaceId, { page, limit: 50 });
    },
    pageSize: 50,
    dependencies: [workspaceId],
    autoFetch: !!workspaceId,
  });

  // Subscribe to SSE events for real-time updates
  useSSE({
    onEvent: (event: SSEEvent) => {
      // Handle item events
      if (event.entity_type === "item") {
        switch (event.type) {
          case "item.created":
            // Refetch items list to show new item
            refetch();
            toast.info(`New item added: ${event.data?.name || "Unknown"}`);
            break;

          case "item.updated":
            // Refetch to update the item in the list
            refetch();
            break;

          case "item.deleted":
            // Refetch to remove archived/deleted item
            refetch();
            break;
        }
      }

      // Handle photo events
      if (event.entity_type === "itemphoto") {
        const itemId = event.data?.item_id;
        if (typeof itemId === "string") {
          // Reload photos for the affected item
          loadItemPhotos([itemId]);
        }
      }
    },
    onConnect: () => {
      console.log("[Items Page] SSE connected");
    },
    onDisconnect: () => {
      console.log("[Items Page] SSE disconnected");
    },
  });

  // Filter items (client-side) - memoized for performance
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filter by archived status
      if (!showArchived && item.is_archived) return false;
      if (showArchived && !item.is_archived) return false;

      // Filter by search query (debounced)
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const matchesSearch =
          item.sku.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query) ||
          item.brand?.toLowerCase().includes(query) ||
          item.model?.toLowerCase().includes(query) ||
          item.manufacturer?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filter by categories (multi-select)
      const categoriesFilter = getFilter("categories");
      if (categoriesFilter && Array.isArray(categoriesFilter.value)) {
        if (!item.category_id || !categoriesFilter.value.includes(item.category_id)) {
          return false;
        }
      }

      // Filter by brands (multi-select)
      const brandsFilter = getFilter("brands");
      if (brandsFilter && Array.isArray(brandsFilter.value)) {
        if (!item.brand || !brandsFilter.value.includes(item.brand)) {
          return false;
        }
      }

      // Filter by warranty
      const warrantyFilter = getFilter("warranty");
      if (warrantyFilter && typeof warrantyFilter.value === "boolean") {
        if (item.lifetime_warranty !== warrantyFilter.value) {
          return false;
        }
      }

      // Filter by insurance
      const insuranceFilter = getFilter("insurance");
      if (insuranceFilter && typeof insuranceFilter.value === "boolean") {
        if (item.is_insured !== insuranceFilter.value) {
          return false;
        }
      }

      // Filter by date range
      const dateFilter = getFilter("dateRange");
      if (dateFilter && typeof dateFilter.value === "object") {
        const range = dateFilter.value as { from: Date | null; to: Date | null };
        const itemDate = new Date(item.created_at);
        if (range.from && itemDate < range.from) return false;
        if (range.to && itemDate > range.to) return false;
      }

      return true;
    });
  }, [items, showArchived, debouncedSearchQuery, getFilter]);

  // Extract unique brands for filter
  const uniqueBrands = useMemo(() => {
    const brands = items
      .map((item) => item.brand)
      .filter((brand): brand is string => Boolean(brand));
    return Array.from(new Set(brands)).sort();
  }, [items]);

  // Sort items (client-side)
  const { sortedData: sortedItems, requestSort, getSortDirection } = useTableSort(filteredItems, "name", "asc");

  // Load photos when sorted items change
  useEffect(() => {
    const visibleItemIds = sortedItems.slice(0, 50).map((item) => item.id);
    loadItemPhotos(visibleItemIds);
  }, [sortedItems, loadItemPhotos]);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73,
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

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return "-";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "-";
  };

  // Export columns definition
  const exportColumns: ColumnDefinition<Item>[] = useMemo(() => [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    { key: "category_id", label: "Category", formatter: (_, item) => getCategoryName(item.category_id) },
    { key: "brand", label: "Brand" },
    { key: "model", label: "Model" },
    { key: "serial_number", label: "Serial Number" },
    { key: "manufacturer", label: "Manufacturer" },
    { key: "barcode", label: "Barcode" },
    { key: "is_insured", label: "Insured", formatter: (value) => value ? "Yes" : "No" },
    { key: "lifetime_warranty", label: "Warranty", formatter: (value) => value ? "Yes" : "No" },
    { key: "warranty_details", label: "Warranty Details" },
    { key: "min_stock_level", label: "Min Stock Level" },
    { key: "short_code", label: "Short Code" },
    { key: "created_at", label: "Created Date", formatter: (value) => new Date(value).toLocaleDateString() },
    { key: "updated_at", label: "Updated Date", formatter: (value) => new Date(value).toLocaleDateString() },
  ], [categories]);

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
        await itemsApi.update(workspaceId!, editingItem.id, updateData);
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
        await itemsApi.create(workspaceId!, createData);
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
        await itemsApi.restore(workspaceId!, item.id);
        toast.success("Item restored successfully");
      } else {
        await itemsApi.archive(workspaceId!, item.id);
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

  // Bulk export selected items to CSV
  const handleBulkExport = () => {
    const selectedItems = sortedItems.filter((item) => selectedIds.has(item.id));
    exportToCSV(selectedItems, exportColumns, generateFilename("items-bulk"));
    toast.success(`Exported ${selectedCount} ${selectedCount === 1 ? "item" : "items"}`);
    clearSelection();
  };

  // Import items from CSV
  const handleImport = async (file: File): Promise<ImportResult> => {
    if (!workspaceId) {
      throw new Error("No workspace selected");
    }

    try {
      const result = await importExportApi.import(workspaceId, "item", file);

      // Refresh the items list after successful import
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

  // Bulk archive selected items
  const handleBulkArchive = async () => {
    if (selectedCount === 0) return;

    try {
      const selectedItems = sortedItems.filter((item) => selectedIds.has(item.id));
      const isRestoring = selectedItems.every((item) => item.is_archived);

      // Archive/restore all selected items
      await Promise.all(
        selectedIdsArray.map((id) => {
          const item = sortedItems.find((i) => i.id === id);
          if (!item) return Promise.resolve();
          return isRestoring ? itemsApi.restore(workspaceId!, id) : itemsApi.archive(workspaceId!, id);
        })
      );

      toast.success(
        `${isRestoring ? "Restored" : "Archived"} ${selectedCount} ${selectedCount === 1 ? "item" : "items"}`
      );
      clearSelection();
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to archive items";
      toast.error("Failed to archive items", {
        description: errorMessage,
      });
    }
  };

  // Keyboard shortcuts for this page
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        ctrl: true,
        description: 'Create new item',
        action: () => openCreateDialog(),
      },
      {
        key: 'r',
        description: 'Refresh items list',
        action: () => refetch(),
        preventDefault: false,
      },
      {
        key: 'a',
        ctrl: true,
        description: 'Select all items',
        action: () => {
          if (sortedItems.length > 0) {
            selectAll(sortedItems.map((i) => i.id));
          }
        },
      },
      {
        key: 'Escape',
        description: 'Clear selection or close dialog',
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
        description: 'Export selected items',
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
              <FilterPopover activeFilterCount={activeFilterCount}>
                <ItemsFilterControls
                  categories={categories}
                  uniqueBrands={uniqueBrands}
                  addFilter={addFilter}
                  getFilter={getFilter}
                />
              </FilterPopover>
              <SavedFilters
                savedFilters={savedFilters}
                currentFilters={getCurrentFilters()}
                onApplyFilter={applySavedFilter}
                onSaveFilter={(name, isDefault) => {
                  saveFilter(name, getCurrentFilters(), isDefault);
                }}
                onDeleteFilter={deleteFilter}
                onSetDefault={setAsDefault}
                hasActiveFilters={activeFilterCount > 0 || !!searchQuery || showArchived}
              />
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
                disabled={filteredItems.length === 0}
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

            {/* Items table */}
            {totalItems === 0 ? (
              <EmptyState
                icon={Package}
                title={
                  searchQuery || activeFilterCount > 0
                    ? "No items found"
                    : showArchived
                    ? "No archived items"
                    : "No items yet"
                }
                description={
                  searchQuery || activeFilterCount > 0
                    ? "Try adjusting your search or filters"
                    : showArchived
                    ? "Archived items will appear here"
                    : "Get started by creating your first item"
                }
              >
                {!searchQuery && activeFilterCount === 0 && !showArchived && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Item
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <Table aria-label="Item catalog">
                    <caption className="sr-only">
                      List of catalog items with SKU, name, category, brand, model, and minimum stock level information.
                      Currently showing {sortedItems.length} {sortedItems.length === 1 ? "item" : "items"}.
                    </caption>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={isAllSelected(sortedItems.map((i) => i.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                selectAll(sortedItems.map((i) => i.id));
                              } else {
                                clearSelection();
                              }
                            }}
                            aria-label="Select all items"
                          />
                        </TableHead>
                        <TableHead className="w-[60px]">Photo</TableHead>
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
                          const item = sortedItems[virtualItem.index];
                          return (
                            <TableRow
                              key={item.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/dashboard/items/${item.id}`)}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`,
                              }}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected(item.id)}
                                  onCheckedChange={() => toggleSelection(item.id)}
                                  aria-label={`Select ${item.name}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="relative">
                                  {(() => {
                                    const photo = itemPhotos[item.id];
                                    if (photo) {
                                      return (
                                        <div className="h-12 w-12 overflow-hidden rounded-md border">
                                          <img
                                            src={photo.urls.small}
                                            alt={item.name}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                          />
                                        </div>
                                      );
                                    } else if (photo === null) {
                                      return <PhotoPlaceholder size="sm" ariaLabel={`No photo for ${item.name}`} />;
                                    } else {
                                      return <div className="h-12 w-12 animate-pulse rounded-md bg-muted" />;
                                    }
                                  })()}
                                  {photoCount[item.id] > 1 && (
                                    <Badge
                                      variant="secondary"
                                      className="absolute -bottom-1 -right-1 h-5 min-w-5 px-1 text-xs"
                                    >
                                      {photoCount[item.id]}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
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
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`}>
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

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
                  value={formData.category_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
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

      {/* Bulk Action Bar */}
      <BulkActionBar selectedCount={selectedCount} onClear={clearSelection}>
        <Button onClick={handleBulkExport} size="sm" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button onClick={handleBulkArchive} size="sm" variant="outline">
          <ArchiveIcon className="mr-2 h-4 w-4" />
          Archive
        </Button>
      </BulkActionBar>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        data={sortedItems}
        allData={items}
        columns={exportColumns}
        filePrefix="items"
        title="Export Items to CSV"
        description="Select columns and data to export"
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="item"
        onImport={handleImport}
        title="Import Items from CSV"
        description="Upload a CSV file to import items. The file should include columns for SKU, name, and other item details."
      />
    </div>
  );
}
