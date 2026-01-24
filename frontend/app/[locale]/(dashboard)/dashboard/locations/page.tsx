"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronRight,
  ChevronDown,
  Home,
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
import { ImportDialog, type ImportResult } from "@/components/ui/import-dialog";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useSSE, type SSEEvent } from "@/lib/hooks/use-sse";
import { useOfflineMutation } from "@/lib/hooks/use-offline-mutation";
import { syncManager } from "@/lib/sync/sync-manager";
import type { SyncEvent } from "@/lib/sync/sync-manager";
import { locationsApi, importExportApi } from "@/lib/api";
import type { Location, LocationCreate, LocationUpdate } from "@/lib/types/locations";
import { cn } from "@/lib/utils";

interface LocationTreeItem extends Location {
  children: LocationTreeItem[];
  expanded?: boolean;
  _pending?: boolean;
}

function buildLocationTree(locations: Location[]): LocationTreeItem[] {
  const map = new Map<string, LocationTreeItem>();
  const roots: LocationTreeItem[] = [];

  // Create map of all locations with empty children
  locations.forEach((loc) => {
    map.set(loc.id, { ...loc, children: [], expanded: true });
  });

  // Build tree structure
  locations.forEach((loc) => {
    const item = map.get(loc.id)!;
    if (loc.parent_location && map.has(loc.parent_location)) {
      map.get(loc.parent_location)!.children.push(item);
    } else {
      roots.push(item);
    }
  });

  // Sort alphabetically
  const sortTree = (items: LocationTreeItem[]): LocationTreeItem[] => {
    items.sort((a, b) => a.name.localeCompare(b.name));
    items.forEach((item) => sortTree(item.children));
    return items;
  };

  return sortTree(roots);
}

function LocationRow({
  location,
  level,
  onEdit,
  onDelete,
  onArchive,
  onToggle,
  onAddSublocation,
  allLocations,
}: {
  location: LocationTreeItem;
  level: number;
  onEdit: (loc: Location) => void;
  onDelete: (loc: Location) => void;
  onArchive: (loc: Location) => void;
  onToggle: (id: string) => void;
  onAddSublocation: (loc: Location) => void;
  allLocations: (Location & { _pending?: boolean })[];
}) {
  const hasChildren = location.children.length > 0;

  // Helper to get parent name for pending badge
  const getParentName = (parentId: string | null): string | null => {
    if (!parentId) return null;
    const parent = allLocations.find(l => l.id === parentId);
    return parent?.name || null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasChildren) return;

    switch (e.key) {
      case "ArrowRight":
        if (!location.expanded) {
          e.preventDefault();
          onToggle(location.id);
        }
        break;
      case "ArrowLeft":
        if (location.expanded) {
          e.preventDefault();
          onToggle(location.id);
        }
        break;
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg group",
          location.is_archived && "opacity-60",
          location._pending && "bg-amber-50"
        )}
        style={{ marginLeft: level * 24 }}
        role="treeitem"
        aria-expanded={hasChildren ? location.expanded : undefined}
        aria-level={level + 1}
      >
        <button
          onClick={() => hasChildren && onToggle(location.id)}
          onKeyDown={handleKeyDown}
          className={cn(
            "p-1 rounded hover:bg-muted",
            !hasChildren && "invisible"
          )}
          aria-label={
            hasChildren
              ? `${location.expanded ? "Collapse" : "Expand"} ${location.name}`
              : undefined
          }
          tabIndex={hasChildren ? 0 : -1}
        >
          {location.expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{location.name}</div>
            {location.short_code && (
              <Badge variant="outline" className="text-xs font-mono">
                {location.short_code}
              </Badge>
            )}
            {location._pending && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
                <Cloud className="w-3 h-3 mr-1 animate-pulse" />
                {(() => {
                  if (!location.parent_location) return 'Pending';
                  const parentName = getParentName(location.parent_location);
                  return parentName ? `Pending... under ${parentName}` : 'Pending';
                })()}
              </Badge>
            )}
            {location.is_archived && (
              <Badge variant="secondary" className="text-xs">
                Archived
              </Badge>
            )}
          </div>
          {location.description && (
            <div className="text-sm text-muted-foreground truncate">
              {location.description}
            </div>
          )}
        </div>

        {hasChildren && (
          <span className="text-xs text-muted-foreground">
            {location.children.length} sub-location{location.children.length !== 1 ? "s" : ""}
          </span>
        )}

        {/* Hide dropdown menu for pending locations */}
        {!location._pending && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                aria-label={`Actions for ${location.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAddSublocation(location)}>
                <Plus className="mr-2 h-4 w-4" />
                Add sublocation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(location)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(location)}>
                {location.is_archived ? (
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
                onClick={() => onDelete(location)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {location.expanded && location.children.length > 0 && (
        <div role="group">
          {location.children.map((child) => (
            <LocationRow
              key={child.id}
              location={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
              onToggle={onToggle}
              onAddSublocation={onAddSublocation}
              allLocations={allLocations}
            />
          ))}
        </div>
      )}
    </>
  );
}

function LocationsTreeSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-2 px-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export default function LocationsPage() {
  const t = useTranslations("locations");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formParentId, setFormParentId] = useState<string>("");
  const [formShortCode, setFormShortCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Optimistic locations for offline mutations
  const [optimisticLocations, setOptimisticLocations] = useState<(Location & { _pending?: boolean })[]>([]);

  // Offline mutation hooks
  const { mutate: createLocationOffline } = useOfflineMutation<Record<string, unknown>>({
    entity: 'locations',
    operation: 'create',
    onMutate: (payload, tempId, dependsOn) => {
      const optimisticLocation: Location & { _pending: boolean } = {
        id: tempId,
        workspace_id: workspaceId!,
        name: (payload.name as string) || '',
        description: (payload.description as string) || null,
        parent_location: (payload.parent_location as string) || null,
        short_code: (payload.short_code as string) || null,
        zone: null,
        shelf: null,
        bin: null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _pending: true,
      };
      setOptimisticLocations(prev => [...prev, optimisticLocation]);
    },
  });

  const { mutate: updateLocationOffline } = useOfflineMutation<Record<string, unknown>>({
    entity: 'locations',
    operation: 'update',
    onMutate: (payload, _tempId) => {
      const entityId = payload._entityId as string;
      if (entityId) {
        setOptimisticLocations(prev => {
          const existing = prev.find(l => l.id === entityId);
          if (existing) {
            return prev.map(l => l.id === entityId ? { ...l, ...payload, _pending: true } : l);
          }
          const fromFetched = locations.find(l => l.id === entityId);
          if (fromFetched) {
            return [...prev, { ...fromFetched, ...payload, _pending: true }];
          }
          return prev;
        });
      }
    },
  });

  // Merge fetched locations with optimistic locations
  const mergedLocations = useMemo(() => {
    const fetchedIds = new Set(locations.map(l => l.id));
    const merged = locations.map(l => {
      const optimistic = optimisticLocations.find(o => o.id === l.id);
      if (optimistic) return { ...l, ...optimistic, _pending: true };
      return l;
    });
    const newOptimistic = optimisticLocations.filter(o => !fetchedIds.has(o.id));
    return [...merged, ...newOptimistic];
  }, [locations, optimisticLocations]);

  // Memoize location tree computation for performance
  const tree = useMemo(() => {
    if (mergedLocations.length === 0) return [];

    const treeData = buildLocationTree(mergedLocations);

    // Apply expansion state from expandedIds Set
    const applyExpansion = (items: LocationTreeItem[]): LocationTreeItem[] => {
      return items.map((item) => ({
        ...item,
        expanded: expandedIds.has(item.id),
        children: applyExpansion(item.children),
      }));
    };

    return applyExpansion(treeData);
  }, [mergedLocations, expandedIds]);

  // Load locations
  const loadLocations = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      const response = await locationsApi.list(workspaceId, { limit: 100 });
      setLocations(response.items);
      // Initialize all locations as expanded by default
      setExpandedIds(new Set(response.items.map((loc) => loc.id)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load locations";
      toast.error("Failed to load locations", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      loadLocations();
    }
  }, [workspaceId, loadLocations]);

  // Subscribe to sync events for offline mutation completion
  useEffect(() => {
    if (!syncManager) return;

    const handleSyncEvent = (event: SyncEvent) => {
      if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'locations') {
        const syncedKey = event.payload.mutation.idempotencyKey;
        const entityId = event.payload.mutation.entityId;
        setOptimisticLocations(prev => prev.filter(l => l.id !== syncedKey && l.id !== entityId));
        loadLocations();
      }
      if (event.type === 'MUTATION_FAILED' && event.payload?.mutation?.entity === 'locations') {
        toast.error('Failed to sync location', {
          description: event.payload.mutation.lastError || 'Please try again',
        });
      }
    };

    return syncManager.subscribe(handleSyncEvent);
  }, [loadLocations]);

  // Subscribe to SSE events for real-time updates
  useSSE({
    onEvent: (event: SSEEvent) => {
      if (event.entity_type === 'location') {
        switch (event.type) {
          case 'location.created':
            loadLocations();
            toast.info(`New location added: ${event.data?.name || 'Unknown'}`);
            break;
          case 'location.updated':
            loadLocations();
            toast.info(`Location updated: ${event.data?.name || 'Unknown'}`);
            break;
          case 'location.deleted':
            loadLocations();
            toast.info('Location deleted');
            break;
        }
      }
    }
  });

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreateDialog = () => {
    setEditingLocation(null);
    setFormName("");
    setFormDescription("");
    setFormParentId("");
    setFormShortCode("");
    setDialogOpen(true);
  };

  const openEditDialog = (location: Location) => {
    setEditingLocation(location);
    setFormName(location.name);
    setFormDescription(location.description || "");
    setFormParentId(location.parent_location || "");
    setFormShortCode(location.short_code || "");
    setDialogOpen(true);
  };

  const openAddSublocationDialog = (parentLocation: Location) => {
    setEditingLocation(null);
    setFormName("");
    setFormDescription("");
    setFormParentId(parentLocation.id);
    setFormShortCode("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!workspaceId) return;

    if (!formName.trim()) {
      toast.error("Please fill in required fields", {
        description: "Name is required",
      });
      return;
    }

    try {
      setIsSaving(true);

      if (editingLocation) {
        // Update existing location - use offline mutation
        const updatePayload: Record<string, unknown> = {
          name: formName.trim(),
          description: formDescription.trim() || null,
          parent_location: formParentId || null,
          _entityId: editingLocation.id,
        };
        await updateLocationOffline(updatePayload, editingLocation.id);
        toast.success(navigator.onLine ? "Location updated" : "Location update queued");
      } else {
        // Create new location - use offline mutation
        // Check if parent is a pending optimistic location
        const parentIsPending = formParentId && optimisticLocations.some(
          l => l.id === formParentId && l._pending
        );
        const dependsOn = parentIsPending ? [formParentId] : undefined;

        const createPayload: Record<string, unknown> = {
          name: formName.trim(),
          description: formDescription.trim() || null,
          parent_location: formParentId || null,
          short_code: formShortCode || undefined,
        };
        await createLocationOffline(createPayload, undefined, dependsOn);
        toast.success(navigator.onLine ? "Location created" : "Location queued for sync");
      }

      setDialogOpen(false);
      // Sync events will trigger reload - no need to call loadLocations()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save location";
      toast.error("Failed to save location", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (location: Location) => {
    if (!workspaceId) return;

    try {
      if (location.is_archived) {
        await locationsApi.restore(workspaceId, location.id);
        toast.success("Location restored successfully");
      } else {
        await locationsApi.archive(workspaceId, location.id);
        toast.success("Location archived successfully");
      }
      loadLocations();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to archive location";
      toast.error("Failed to archive location", {
        description: errorMessage,
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingLocation || !workspaceId) return;

    try {
      await locationsApi.delete(workspaceId, deletingLocation.id);
      toast.success("Location deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingLocation(null);
      loadLocations();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete location";
      toast.error("Failed to delete location", {
        description: errorMessage,
      });
    }
  };

  const handleImport = async (file: File): Promise<ImportResult> => {
    if (!workspaceId) {
      throw new Error("No workspace selected");
    }

    try {
      const result = await importExportApi.import(workspaceId, "location", file);

      // Refresh the locations list after successful import
      if (result.successful_imports > 0) {
        loadLocations();
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

  // Filter locations for display - memoized for performance
  const filteredTree = useMemo(() => {
    const filterTree = (items: LocationTreeItem[]): LocationTreeItem[] => {
      return items.reduce<LocationTreeItem[]>((acc, location) => {
        const matchesArchived = showArchived ? location.is_archived : !location.is_archived;
        if (!matchesArchived) return acc;

        let matchesSearch = true;
        if (debouncedSearchQuery.trim()) {
          const query = debouncedSearchQuery.toLowerCase();
          matchesSearch =
            location.name.toLowerCase().includes(query) ||
            (location.description?.toLowerCase().includes(query) ?? false) ||
            (location.short_code?.toLowerCase().includes(query) ?? false);
        }

        const filteredChildren = location.children.length > 0
          ? filterTree(location.children)
          : [];

        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...location,
            children: filteredChildren.length > 0 ? filteredChildren : location.children,
          });
        }

        return acc;
      }, []);
    };

    return filterTree(tree);
  }, [tree, debouncedSearchQuery, showArchived]);

  // Get available parent locations (exclude self and descendants when editing)
  // Include optimistic locations so user can select pending parents
  const getAvailableParents = (): (Location & { _pending?: boolean })[] => {
    const allLocations = [...locations, ...optimisticLocations.filter(o => !locations.some(l => l.id === o.id))];

    if (!editingLocation) return allLocations.filter(loc => !loc.is_archived);

    const descendantIds = new Set<string>();
    const findDescendants = (parentId: string) => {
      descendantIds.add(parentId);
      allLocations
        .filter((loc) => loc.parent_location === parentId)
        .forEach((loc) => findDescendants(loc.id));
    };
    findDescendants(editingLocation.id);

    return allLocations.filter(
      (loc) => !descendantIds.has(loc.id) && !loc.is_archived
    );
  };

  if (workspaceLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <LocationsTreeSkeleton />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
        <p className="text-muted-foreground">
          Manage storage locations with hierarchical organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Storage Locations</CardTitle>
              <CardDescription>
                {locations.length} location{locations.length !== 1 ? "s" : ""} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                <Archive className="mr-2 h-4 w-4" />
                {showArchived ? "Archived" : "Active"}
              </Button>
            </div>

            {/* Locations tree */}
            {filteredTree.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title={
                  searchQuery
                    ? "No locations found"
                    : showArchived
                    ? "No archived locations"
                    : "No locations yet"
                }
                description={
                  searchQuery
                    ? "Try adjusting your search"
                    : showArchived
                    ? "Archived locations will appear here"
                    : "Get started by creating your first location"
                }
              >
                {!searchQuery && !showArchived && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Location
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="space-y-1" role="tree" aria-label="Location hierarchy">
                {filteredTree.map((location) => (
                  <LocationRow
                    key={location.id}
                    location={location}
                    level={0}
                    onEdit={openEditDialog}
                    onDelete={(loc) => {
                      setDeletingLocation(loc);
                      setDeleteDialogOpen(true);
                    }}
                    onArchive={handleArchive}
                    onToggle={handleToggle}
                    onAddSublocation={openAddSublocationDialog}
                    allLocations={mergedLocations}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Edit Location" : "Create New Location"}
            </DialogTitle>
            <DialogDescription>
              {editingLocation
                ? "Update the location details below"
                : "Add a new storage location"}
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
                placeholder="e.g., Warehouse A, Room 101"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">Parent Location</Label>
              <Select
                value={formParentId || "none"}
                onValueChange={(value) => setFormParentId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (root location)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      None (root location)
                    </div>
                  </SelectItem>
                  {getAvailableParents().map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}{'_pending' in loc && loc._pending ? ' (pending)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="short_code">Short Code (QR Label)</Label>
              {editingLocation ? (
                <Input
                  id="short_code"
                  value={formShortCode}
                  readOnly
                  className="bg-muted font-mono"
                />
              ) : (
                <Input
                  id="short_code"
                  value={formShortCode}
                  onChange={(e) => setFormShortCode(e.target.value)}
                  placeholder="Leave empty to auto-generate"
                  maxLength={8}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe this location..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingLocation ? "Update" : "Create"}
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
              This will permanently delete the location "{deletingLocation?.name}".
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

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="location"
        onImport={handleImport}
        title="Import Locations from CSV"
        description="Upload a CSV file to import locations. The file should include columns for name, description, and parent location."
      />
    </div>
  );
}
