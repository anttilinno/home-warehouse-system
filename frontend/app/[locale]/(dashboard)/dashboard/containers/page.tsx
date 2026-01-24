"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Box,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  MapPin,
  Download,
  Upload,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useFilters } from "@/lib/hooks/use-filters";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useSSE, type SSEEvent } from "@/lib/hooks/use-sse";
import { containersApi, locationsApi, importExportApi } from "@/lib/api";
import type { Container, ContainerCreate, ContainerUpdate } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";
import { exportToCSV, generateFilename, type ColumnDefinition } from "@/lib/utils/csv-export";
import { useOfflineMutation, getPendingMutationsForEntity } from "@/lib/hooks/use-offline-mutation";
import { syncManager } from "@/lib/sync/sync-manager";
import type { SyncEvent } from "@/lib/sync/sync-manager";
import { cn } from "@/lib/utils";

interface ContainersFilterControlsProps {
  locations: Location[];
  addFilter: (filter: any) => void;
  getFilter: (key: string) => any;
}

function ContainersFilterControls({
  locations,
  addFilter,
  getFilter,
}: ContainersFilterControlsProps) {
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [minCapacity, setMinCapacity] = useState<string>("");
  const [maxCapacity, setMaxCapacity] = useState<string>("");

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

  // Update capacity range
  const updateCapacityRange = () => {
    const min = minCapacity ? parseInt(minCapacity, 10) : null;
    const max = maxCapacity ? parseInt(maxCapacity, 10) : null;

    if (min !== null || max !== null) {
      addFilter({
        key: "capacity",
        label: "Capacity",
        value: { min, max },
        type: "number-range",
      });
    } else {
      addFilter({
        key: "capacity",
        label: "Capacity",
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

      {/* Capacity Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Capacity Range</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={minCapacity}
            onChange={(e) => setMinCapacity(e.target.value)}
            onBlur={updateCapacityRange}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="number"
            placeholder="Max"
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(e.target.value)}
            onBlur={updateCapacityRange}
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
}

function ContainersTableSkeleton() {
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
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Short Code</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function ContainersPage() {
  const t = useTranslations("containers");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [locations, setLocations] = useState<Location[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [showArchived, setShowArchived] = useState(false);

  // Enhanced filters
  const {
    filterChips,
    activeFilterCount,
    addFilter,
    removeFilter,
    clearFilters,
    getFilter,
  } = useFilters();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContainer, setDeletingContainer] = useState<Container | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formShortCode, setFormShortCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Optimistic state for offline mutations
  const [optimisticContainers, setOptimisticContainers] = useState<(Container & { _pending?: boolean })[]>([]);
  const [optimisticLocations, setOptimisticLocations] = useState<(Location & { _pending?: boolean })[]>([]);

  // Infinite scroll for containers
  const {
    items: containers,
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
      return await containersApi.list(workspaceId, { page, limit: 50 });
    },
    pageSize: 50,
    dependencies: [workspaceId],
    autoFetch: !!workspaceId,
  });

  // Load locations
  const loadLocations = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const response = await locationsApi.list(workspaceId, { limit: 100 });
      setLocations(response.items.filter(loc => !loc.is_archived));
    } catch (error) {
      console.error("Failed to load locations:", error);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      loadLocations();
    }
  }, [workspaceId, loadLocations]);

  // Offline mutation hooks
  const { mutate: createContainerOffline } = useOfflineMutation<Record<string, unknown>>({
    entity: 'containers',
    operation: 'create',
    onMutate: (payload, tempId) => {
      const optimisticContainer: Container & { _pending: boolean } = {
        id: tempId,
        workspace_id: workspaceId!,
        name: (payload.name as string) || '',
        description: (payload.description as string) || null,
        location_id: (payload.location_id as string) || '',
        capacity: (payload.capacity as string) || null,
        short_code: (payload.short_code as string) || null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _pending: true,
      };
      setOptimisticContainers(prev => [...prev, optimisticContainer]);
    },
  });

  const { mutate: updateContainerOffline } = useOfflineMutation<Record<string, unknown>>({
    entity: 'containers',
    operation: 'update',
    onMutate: (payload, _tempId) => {
      const entityId = payload._entityId as string;
      if (entityId) {
        setOptimisticContainers(prev => {
          const existing = prev.find(c => c.id === entityId);
          if (existing) {
            return prev.map(c => c.id === entityId ? { ...c, ...payload, _pending: true } : c);
          }
          const fromFetched = containers.find(c => c.id === entityId);
          if (fromFetched) {
            return [...prev, { ...fromFetched, ...payload, _pending: true }];
          }
          return prev;
        });
      }
    },
  });

  // Merge fetched containers with optimistic containers
  const mergedContainers = useMemo(() => {
    const fetchedIds = new Set(containers.map(c => c.id));
    const merged = containers.map(c => {
      const optimistic = optimisticContainers.find(o => o.id === c.id);
      if (optimistic) return { ...c, ...optimistic, _pending: true };
      return c;
    });
    const newOptimistic = optimisticContainers.filter(o => !fetchedIds.has(o.id));
    return [...merged, ...newOptimistic];
  }, [containers, optimisticContainers]);

  // Merge fetched locations with optimistic locations for dropdown
  const allLocations = useMemo(() => {
    const fetchedIds = new Set(locations.map(l => l.id));
    const merged = locations.map(l => {
      const optimistic = optimisticLocations.find(o => o.id === l.id);
      if (optimistic) return { ...l, ...optimistic };
      return l;
    });
    const newOptimistic = optimisticLocations.filter(o => !fetchedIds.has(o.id));
    return [...merged, ...newOptimistic];
  }, [locations, optimisticLocations]);

  // Subscribe to sync events for offline mutation completion
  useEffect(() => {
    if (!syncManager) return;

    const handleSyncEvent = (event: SyncEvent) => {
      if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'containers') {
        const syncedKey = event.payload.mutation.idempotencyKey;
        const entityId = event.payload.mutation.entityId;
        setOptimisticContainers(prev => prev.filter(c => c.id !== syncedKey && c.id !== entityId));
        refetch();
      }
      if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'locations') {
        const syncedKey = event.payload.mutation.idempotencyKey;
        const entityId = event.payload.mutation.entityId;
        setOptimisticLocations(prev => prev.filter(l => l.id !== syncedKey && l.id !== entityId));
      }
      if (event.type === 'MUTATION_FAILED' && event.payload?.mutation?.entity === 'containers') {
        toast.error('Failed to sync container', {
          description: event.payload.mutation.lastError || 'Please try again',
        });
      }
    };

    return syncManager.subscribe(handleSyncEvent);
  }, [refetch]);

  // Load pending location creates on mount for dependency tracking
  useEffect(() => {
    async function loadPendingLocations() {
      const pendingLocationMutations = await getPendingMutationsForEntity('locations');
      const pendingLocations = pendingLocationMutations
        .filter(m => m.operation === 'create')
        .map(m => ({
          id: m.idempotencyKey,
          workspace_id: workspaceId || '',
          name: (m.payload.name as string) || '',
          description: (m.payload.description as string) || null,
          parent_location: (m.payload.parent_location as string) || null,
          short_code: (m.payload.short_code as string) || null,
          zone: null,
          shelf: null,
          bin: null,
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _pending: true,
        } as Location & { _pending: boolean }));
      setOptimisticLocations(pendingLocations);
    }
    loadPendingLocations();
  }, [workspaceId]);

  // Subscribe to SSE events for real-time updates
  useSSE({
    onEvent: (event: SSEEvent) => {
      if (event.entity_type === 'container') {
        switch (event.type) {
          case 'container.created':
            refetch();
            toast.info(`New container added: ${event.data?.name || 'Unknown'}`);
            break;
          case 'container.updated':
            refetch();
            toast.info(`Container updated: ${event.data?.name || 'Unknown'}`);
            break;
          case 'container.deleted':
            refetch();
            toast.info('Container deleted');
            break;
        }
      }
    }
  });

  // Filter containers - memoized for performance
  const filteredContainers = useMemo(() => {
    return mergedContainers.filter((container) => {
      // Filter by archived status
      if (!showArchived && container.is_archived) return false;
      if (showArchived && !container.is_archived) return false;

      // Filter by search query
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const location = allLocations.find(l => l.id === container.location_id);
        const matchesSearch =
          container.name.toLowerCase().includes(query) ||
          container.short_code?.toLowerCase().includes(query) ||
          container.description?.toLowerCase().includes(query) ||
          location?.name.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filter by locations (multi-select)
      const locationsFilter = getFilter("locations");
      if (locationsFilter && Array.isArray(locationsFilter.value)) {
        if (!container.location_id || !locationsFilter.value.includes(container.location_id)) {
          return false;
        }
      }

      // Filter by capacity range
      const capacityFilter = getFilter("capacity");
      if (capacityFilter && typeof capacityFilter.value === "object") {
        const range = capacityFilter.value as { min: number | null; max: number | null };
        if (!container.capacity) return false;
        const capacity = parseInt(container.capacity, 10);
        if (isNaN(capacity)) return false;
        if (range.min !== null && capacity < range.min) return false;
        if (range.max !== null && capacity > range.max) return false;
      }

      return true;
    });
  }, [mergedContainers, showArchived, debouncedSearchQuery, allLocations, getFilter]);

  // Helper to get location name by ID (includes pending locations)
  const getLocationName = (locationId: string) => {
    const location = allLocations.find((l) => l.id === locationId);
    return location?.name || "Unknown";
  };

  // Flatten container data for sorting (add location name)
  const flattenedContainers = useMemo(() => {
    return filteredContainers.map(container => ({
      ...container,
      location_name: getLocationName(container.location_id),
      _pending: '_pending' in container ? (container._pending as boolean | undefined) : undefined,
    }));
  }, [filteredContainers, allLocations]);

  // Sort containers
  const { sortedData: sortedContainers, requestSort, getSortDirection } = useTableSort(flattenedContainers, "name", "asc");

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
        description: 'Create new container',
        action: () => openCreateDialog(),
      },
      {
        key: 'r',
        description: 'Refresh containers list',
        action: () => refetch(),
        preventDefault: false,
      },
      {
        key: 'a',
        ctrl: true,
        description: 'Select all containers',
        action: () => {
          if (sortedContainers.length > 0) {
            selectAll(sortedContainers.filter(c => !c._pending).map((c) => c.id));
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
    ],
    enabled: true,
    ignoreInputFields: true,
  });

  // Export columns definition
  const exportColumns: ColumnDefinition<Container>[] = useMemo(() => [
    { key: "name", label: "Name" },
    { key: "location_id", label: "Location", formatter: (_, container) => getLocationName(container.location_id) },
    { key: "capacity", label: "Capacity" },
    { key: "short_code", label: "Short Code" },
    { key: "description", label: "Description" },
    { key: "created_at", label: "Created Date", formatter: (value) => new Date(value).toLocaleDateString() },
    { key: "updated_at", label: "Updated Date", formatter: (value) => new Date(value).toLocaleDateString() },
  ], [locations]);

  const openCreateDialog = () => {
    setEditingContainer(null);
    setFormName("");
    setFormDescription("");
    setFormLocationId("");
    setFormCapacity("");
    setFormShortCode("");
    setDialogOpen(true);
  };

  const openEditDialog = (container: Container) => {
    setEditingContainer(container);
    setFormName(container.name);
    setFormDescription(container.description || "");
    setFormLocationId(container.location_id);
    setFormCapacity(container.capacity || "");
    setFormShortCode(container.short_code || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!workspaceId) return;

    if (!formName.trim() || !formLocationId) {
      toast.error("Please fill in required fields", {
        description: "Name and Location are required",
      });
      return;
    }

    try {
      setIsSaving(true);

      if (editingContainer) {
        // Update existing container - use offline mutation
        const updatePayload: Record<string, unknown> = {
          name: formName.trim(),
          location_id: formLocationId,
          description: formDescription.trim() || null,
          capacity: formCapacity || null,
          _entityId: editingContainer.id,
        };
        await updateContainerOffline(updatePayload, editingContainer.id);
        toast.success(navigator.onLine ? "Container updated" : "Container update queued");
      } else {
        // Create new container - use offline mutation
        // Check if location is a pending optimistic location
        const locationIsPending = optimisticLocations.some(
          l => l.id === formLocationId && l._pending
        );
        const dependsOn = locationIsPending ? [formLocationId] : undefined;

        const createPayload: Record<string, unknown> = {
          name: formName.trim(),
          location_id: formLocationId,
          description: formDescription.trim() || null,
          capacity: formCapacity || null,
          short_code: formShortCode || undefined,
        };
        await createContainerOffline(createPayload, undefined, dependsOn);
        toast.success(navigator.onLine ? "Container created" : "Container queued for sync");
      }

      setDialogOpen(false);
      // Sync events will trigger refetch - no need to call refetch() directly
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save container";
      toast.error("Failed to save container", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (container: Container) => {
    if (!workspaceId) return;
    try {
      if (container.is_archived) {
        await containersApi.restore(workspaceId, container.id);
        toast.success("Container restored successfully");
      } else {
        await containersApi.archive(workspaceId, container.id);
        toast.success("Container archived successfully");
      }
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to archive container";
      toast.error("Failed to archive container", {
        description: errorMessage,
      });
    }
  };

  // Bulk export selected containers to CSV
  const handleBulkExport = () => {
    const selectedContainers = sortedContainers.filter((c) => selectedIds.has(c.id));
    exportToCSV(selectedContainers, exportColumns, generateFilename("containers-bulk"));
    toast.success(`Exported ${selectedCount} ${selectedCount === 1 ? "container" : "containers"}`);
    clearSelection();
  };

  // Import containers from CSV
  const handleImport = async (file: File): Promise<ImportResult> => {
    if (!workspaceId) throw new Error("No workspace selected");
    try {
      const result = await importExportApi.import(workspaceId, "container", file);
      if (result.successful_imports > 0) refetch();
      return {
        success: result.successful_imports,
        failed: result.failed_imports,
        errors: result.errors.map((e) => ({ row: e.row_number, message: e.error })),
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Import failed");
    }
  };

  // Bulk archive selected containers
  const handleBulkArchive = async () => {
    if (selectedCount === 0) return;

    try {
      const selectedContainers = sortedContainers.filter((c) => selectedIds.has(c.id));
      const isRestoring = selectedContainers.every((c) => c.is_archived);

      // Archive/restore all selected containers
      await Promise.all(
        selectedIdsArray.map((id) => {
          const container = sortedContainers.find((c) => c.id === id);
          if (!container || !workspaceId) return Promise.resolve();
          return isRestoring ? containersApi.restore(workspaceId, id) : containersApi.archive(workspaceId, id);
        })
      );

      toast.success(
        `${isRestoring ? "Restored" : "Archived"} ${selectedCount} ${selectedCount === 1 ? "container" : "containers"}`
      );
      clearSelection();
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to archive containers";
      toast.error("Failed to archive containers", {
        description: errorMessage,
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingContainer || !workspaceId) return;

    try {
      await containersApi.delete(workspaceId, deletingContainer.id);
      toast.success("Container deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingContainer(null);
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete container";
      toast.error("Failed to delete container", {
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
        <ContainersTableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Containers</h1>
        <p className="text-muted-foreground">
          Manage storage containers within locations for organized inventory
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Storage Containers</CardTitle>
              <CardDescription>
                {sortedContainers.length} container{sortedContainers.length !== 1 ? "s" : ""}
                {searchQuery && " matching your search"}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Container
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
                  placeholder="Search by name, location, or short code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <FilterPopover activeFilterCount={activeFilterCount}>
                <ContainersFilterControls
                  locations={locations}
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
                disabled={filteredContainers.length === 0}
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

            {/* Containers table */}
            {sortedContainers.length === 0 ? (
              <EmptyState
                icon={Box}
                title={
                  searchQuery || activeFilterCount > 0
                    ? "No containers found"
                    : showArchived
                    ? "No archived containers"
                    : "No containers yet"
                }
                description={
                  searchQuery || activeFilterCount > 0
                    ? "Try adjusting your search or filters"
                    : showArchived
                    ? "Archived containers will appear here"
                    : "Get started by creating your first container"
                }
              >
                {!searchQuery && activeFilterCount === 0 && !showArchived && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Container
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="rounded-lg border">
                <Table aria-label="Storage containers">
                  <caption className="sr-only">
                    List of storage containers with location, capacity, and short code information.
                    Currently showing {sortedContainers.length} {sortedContainers.length === 1 ? "container" : "containers"}.
                  </caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllSelected(sortedContainers.filter(c => !c._pending).map((c) => c.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAll(sortedContainers.filter(c => !c._pending).map((c) => c.id));
                            } else {
                              clearSelection();
                            }
                          }}
                          aria-label="Select all containers"
                        />
                      </TableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("name")}
                        onSort={() => requestSort("name")}
                      >
                        Name
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("location_name")}
                        onSort={() => requestSort("location_name")}
                      >
                        Location
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("capacity")}
                        onSort={() => requestSort("capacity")}
                      >
                        Capacity
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("short_code")}
                        onSort={() => requestSort("short_code")}
                      >
                        Short Code
                      </SortableTableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedContainers.map((container) => (
                      <TableRow key={container.id} className={cn(container._pending && "bg-amber-50")}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected(container.id)}
                            onCheckedChange={() => toggleSelection(container.id)}
                            disabled={container._pending}
                            aria-label={`Select ${container.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {container.name}
                              {container._pending && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
                                  <Cloud className="w-3 h-3 mr-1 animate-pulse" />
                                  {(() => {
                                    const locationName = getLocationName(container.location_id);
                                    return locationName ? `Pending... in ${locationName}` : 'Pending';
                                  })()}
                                </Badge>
                              )}
                              {container.is_archived && (
                                <Badge variant="secondary" className="text-xs">
                                  Archived
                                </Badge>
                              )}
                            </div>
                            {container.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {container.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {getLocationName(container.location_id)}
                          </div>
                        </TableCell>
                        <TableCell>{container.capacity || "-"}</TableCell>
                        <TableCell>
                          {container.short_code ? (
                            <Badge variant="outline" className="font-mono">
                              {container.short_code}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {!container._pending && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`Actions for ${container.name}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(container)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleArchive(container)}>
                                  {container.is_archived ? (
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
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDeletingContainer(container);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
              loadingText="Loading more containers..."
              endText={`Showing all ${sortedContainers.length} container${sortedContainers.length !== 1 ? "s" : ""}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingContainer ? "Edit Container" : "Create New Container"}
            </DialogTitle>
            <DialogDescription>
              {editingContainer
                ? "Update the container details below"
                : "Add a new storage container"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Plastic Bin A, Metal Box 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">
                Location <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formLocationId}
                onValueChange={(value) => setFormLocationId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {allLocations.filter(loc => !loc.is_archived).map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}{'_pending' in loc && loc._pending ? ' (pending)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
                placeholder="e.g., 50L, 20 items, Small"
              />
            </div>

            {!editingContainer && (
              <div className="space-y-2">
                <Label htmlFor="short_code">Short Code (QR Label)</Label>
                <Input
                  id="short_code"
                  value={formShortCode}
                  onChange={(e) => setFormShortCode(e.target.value)}
                  placeholder="e.g., CON-001"
                  maxLength={20}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe this container..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingContainer ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the container "{deletingContainer?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Bar */}
      <BulkActionBar selectedCount={selectedCount} onClear={clearSelection}>
        <Button onClick={handleBulkExport} size="sm" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button onClick={handleBulkArchive} size="sm" variant="outline">
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </Button>
      </BulkActionBar>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        data={sortedContainers}
        allData={containers}
        columns={exportColumns}
        filePrefix="containers"
        title="Export Containers to CSV"
        description="Select columns and data to export"
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="container"
        onImport={handleImport}
        title="Import Containers from CSV"
        description="Upload a CSV file to import containers. The file should include columns for name, location, capacity, and other details."
      />
    </div>
  );
}
