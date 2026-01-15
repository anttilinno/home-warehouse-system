"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { locationsApi } from "@/lib/api";
import type { Location, LocationCreate, LocationUpdate } from "@/lib/types/locations";
import { cn } from "@/lib/utils";

interface LocationTreeItem extends Location {
  children: LocationTreeItem[];
  expanded?: boolean;
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
}: {
  location: LocationTreeItem;
  level: number;
  onEdit: (loc: Location) => void;
  onDelete: (loc: Location) => void;
  onArchive: (loc: Location) => void;
  onToggle: (id: string) => void;
}) {
  const hasChildren = location.children.length > 0;

  const getLocationDetails = () => {
    const details: string[] = [];
    if (location.zone) details.push(`Zone: ${location.zone}`);
    if (location.shelf) details.push(`Shelf: ${location.shelf}`);
    if (location.bin) details.push(`Bin: ${location.bin}`);
    return details.join(" · ");
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg group",
          location.is_archived && "opacity-60"
        )}
        style={{ marginLeft: level * 24 }}
      >
        <button
          onClick={() => hasChildren && onToggle(location.id)}
          className={cn(
            "p-1 rounded hover:bg-muted",
            !hasChildren && "invisible"
          )}
        >
          {location.expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
            {location.is_archived && (
              <Badge variant="secondary" className="text-xs">
                Archived
              </Badge>
            )}
          </div>
          {(location.description || getLocationDetails()) && (
            <div className="text-sm text-muted-foreground truncate">
              {location.description || getLocationDetails()}
            </div>
          )}
        </div>

        {hasChildren && (
          <span className="text-xs text-muted-foreground">
            {location.children.length} sub-location{location.children.length !== 1 ? "s" : ""}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
      </div>

      {location.expanded &&
        location.children.map((child) => (
          <LocationRow
            key={child.id}
            location={child}
            level={level + 1}
            onEdit={onEdit}
            onDelete={onDelete}
            onArchive={onArchive}
            onToggle={onToggle}
          />
        ))}
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
  const [tree, setTree] = useState<LocationTreeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formParentId, setFormParentId] = useState<string>("");
  const [formZone, setFormZone] = useState("");
  const [formShelf, setFormShelf] = useState("");
  const [formBin, setFormBin] = useState("");
  const [formShortCode, setFormShortCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load locations
  const loadLocations = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      const response = await locationsApi.list({ limit: 500 });
      setLocations(response.items);
      setTree(buildLocationTree(response.items));
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

  const handleToggle = (id: string) => {
    const toggleInTree = (items: LocationTreeItem[]): LocationTreeItem[] => {
      return items.map((item) => {
        if (item.id === id) {
          return { ...item, expanded: !item.expanded };
        }
        return { ...item, children: toggleInTree(item.children) };
      });
    };
    setTree(toggleInTree(tree));
  };

  const openCreateDialog = () => {
    setEditingLocation(null);
    setFormName("");
    setFormDescription("");
    setFormParentId("");
    setFormZone("");
    setFormShelf("");
    setFormBin("");
    setFormShortCode("");
    setDialogOpen(true);
  };

  const openEditDialog = (location: Location) => {
    setEditingLocation(location);
    setFormName(location.name);
    setFormDescription(location.description || "");
    setFormParentId(location.parent_location || "");
    setFormZone(location.zone || "");
    setFormShelf(location.shelf || "");
    setFormBin(location.bin || "");
    setFormShortCode(location.short_code || "");
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
        // Update existing location
        const updateData: LocationUpdate = {
          name: formName,
          description: formDescription || undefined,
          parent_location: formParentId || undefined,
          zone: formZone || undefined,
          shelf: formShelf || undefined,
          bin: formBin || undefined,
        };
        await locationsApi.update(editingLocation.id, updateData);
        toast.success("Location updated successfully");
      } else {
        // Create new location
        const createData: LocationCreate = {
          name: formName,
          description: formDescription || undefined,
          parent_location: formParentId || undefined,
          zone: formZone || undefined,
          shelf: formShelf || undefined,
          bin: formBin || undefined,
          short_code: formShortCode || undefined,
        };
        await locationsApi.create(createData);
        toast.success("Location created successfully");
      }

      setDialogOpen(false);
      loadLocations();
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
    try {
      if (location.is_archived) {
        await locationsApi.restore(location.id);
        toast.success("Location restored successfully");
      } else {
        await locationsApi.archive(location.id);
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
    if (!deletingLocation) return;

    try {
      await locationsApi.delete(deletingLocation.id);
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

  // Filter locations for display
  const filteredTree = tree.filter((location) => {
    const matchesArchived = showArchived ? location.is_archived : !location.is_archived;
    if (!matchesArchived) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        location.name.toLowerCase().includes(query) ||
        location.zone?.toLowerCase().includes(query) ||
        location.shelf?.toLowerCase().includes(query) ||
        location.bin?.toLowerCase().includes(query) ||
        location.short_code?.toLowerCase().includes(query);
      return matchesSearch;
    }

    return true;
  });

  // Get available parent locations (exclude self and descendants when editing)
  const getAvailableParents = () => {
    if (!editingLocation) return locations.filter(loc => !loc.is_archived);

    const descendantIds = new Set<string>();
    const findDescendants = (parentId: string) => {
      descendantIds.add(parentId);
      locations
        .filter((loc) => loc.parent_location === parentId)
        .forEach((loc) => findDescendants(loc.id));
    };
    findDescendants(editingLocation.id);

    return locations.filter(
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
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
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
                  placeholder="Search by name, zone, shelf, or bin..."
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
              <div className="space-y-1">
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
                value={formParentId}
                onValueChange={(value) => setFormParentId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (root location)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      None (root location)
                    </div>
                  </SelectItem>
                  {getAvailableParents().map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zone">Zone</Label>
                <Input
                  id="zone"
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                  placeholder="e.g., A, B, C"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shelf">Shelf</Label>
                <Input
                  id="shelf"
                  value={formShelf}
                  onChange={(e) => setFormShelf(e.target.value)}
                  placeholder="e.g., 1, 2, 3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bin">Bin</Label>
                <Input
                  id="bin"
                  value={formBin}
                  onChange={(e) => setFormBin(e.target.value)}
                  placeholder="e.g., 1A, 2B"
                />
              </div>
            </div>

            {!editingLocation && (
              <div className="space-y-2">
                <Label htmlFor="short_code">Short Code (QR Label)</Label>
                <Input
                  id="short_code"
                  value={formShortCode}
                  onChange={(e) => setFormShortCode(e.target.value)}
                  placeholder="e.g., LOC-001"
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
    </div>
  );
}
