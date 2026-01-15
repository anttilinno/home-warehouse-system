"use client";

import { useState, useEffect, useCallback } from "react";
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
import { InfiniteScrollTrigger } from "@/components/ui/infinite-scroll-trigger";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import { containersApi, locationsApi } from "@/lib/api";
import type { Container, ContainerCreate, ContainerUpdate } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";

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
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContainer, setDeletingContainer] = useState<Container | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formShortCode, setFormShortCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
      return await containersApi.list({ page, limit: 50 });
    },
    pageSize: 50,
    dependencies: [workspaceId],
    autoFetch: !!workspaceId,
  });

  // Load locations
  const loadLocations = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const response = await locationsApi.list({ limit: 500 });
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

  // Filter containers
  const filteredContainers = containers.filter((container) => {
    // Filter by archived status
    if (!showArchived && container.is_archived) return false;
    if (showArchived && !container.is_archived) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const location = locations.find(l => l.id === container.location_id);
      const matchesSearch =
        container.name.toLowerCase().includes(query) ||
        container.short_code?.toLowerCase().includes(query) ||
        container.capacity?.toLowerCase().includes(query) ||
        location?.name.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Filter by location
    if (locationFilter && container.location_id !== locationFilter) return false;

    return true;
  });

  // Sort containers
  const { sortedData: sortedContainers, requestSort, getSortDirection } = useTableSort(filteredContainers, "name", "asc");

  const getLocationName = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId);
    return location?.name || "Unknown";
  };

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
        // Update existing container
        const updateData: ContainerUpdate = {
          name: formName,
          location_id: formLocationId,
          description: formDescription || undefined,
          capacity: formCapacity || undefined,
        };
        await containersApi.update(editingContainer.id, updateData);
        toast.success("Container updated successfully");
      } else {
        // Create new container
        const createData: ContainerCreate = {
          name: formName,
          location_id: formLocationId,
          description: formDescription || undefined,
          capacity: formCapacity || undefined,
          short_code: formShortCode || undefined,
        };
        await containersApi.create(createData);
        toast.success("Container created successfully");
      }

      setDialogOpen(false);
      refetch();
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
    try {
      if (container.is_archived) {
        await containersApi.restore(container.id);
        toast.success("Container restored successfully");
      } else {
        await containersApi.archive(container.id);
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

  const handleDelete = async () => {
    if (!deletingContainer) return;

    try {
      await containersApi.delete(deletingContainer.id);
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
              <Select
                value={locationFilter || "all"}
                onValueChange={(value) => setLocationFilter(value === "all" ? null : value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
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

            {/* Containers table */}
            {sortedContainers.length === 0 ? (
              <EmptyState
                icon={Box}
                title={
                  searchQuery || locationFilter
                    ? "No containers found"
                    : showArchived
                    ? "No archived containers"
                    : "No containers yet"
                }
                description={
                  searchQuery || locationFilter
                    ? "Try adjusting your search or filters"
                    : showArchived
                    ? "Archived containers will appear here"
                    : "Get started by creating your first container"
                }
              >
                {!searchQuery && !locationFilter && !showArchived && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Container
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        sortDirection={getSortDirection("name")}
                        onSort={() => requestSort("name")}
                      >
                        Name
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("location_id")}
                        onSort={() => requestSort("location_id")}
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
                      <TableRow key={container.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {container.name}
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
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
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
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
    </div>
  );
}
