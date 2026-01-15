"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Download,
  Upload,
  Archive,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InfiniteScrollTrigger } from "@/components/ui/infinite-scroll-trigger";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { ExportDialog } from "@/components/ui/export-dialog";
import { ImportDialog, type ImportResult } from "@/components/ui/import-dialog";
import { InlineEditCell } from "@/components/ui/inline-edit-cell";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { borrowersApi, importExportApi } from "@/lib/api";
import type { Borrower, BorrowerCreate, BorrowerUpdate } from "@/lib/types/borrowers";
import { exportToCSV, generateFilename, type ColumnDefinition } from "@/lib/utils/csv-export";

function BorrowersTableSkeleton() {
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
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function BorrowersPage() {
  const t = useTranslations("borrowers");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBorrower, setDeletingBorrower] = useState<Borrower | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Infinite scroll for borrowers
  const {
    items: borrowers,
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
      return await borrowersApi.list({ page, limit: 50 });
    },
    pageSize: 50,
    dependencies: [workspaceId],
    autoFetch: !!workspaceId,
  });

  // Filter borrowers - memoized for performance
  const filteredBorrowers = useMemo(() => {
    return borrowers.filter((borrower) => {
      // Filter archived
      if (borrower.is_archived) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          borrower.name.toLowerCase().includes(query) ||
          borrower.email?.toLowerCase().includes(query) ||
          borrower.phone?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [borrowers, searchQuery]);

  // Sort borrowers
  const { sortedData: sortedBorrowers, requestSort, getSortDirection } = useTableSort(filteredBorrowers, "name", "asc");

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

  // Export columns definition
  const exportColumns: ColumnDefinition<Borrower>[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
    { key: "notes", label: "Notes" },
    { key: "created_at", label: "Created Date", formatter: (value) => new Date(value).toLocaleDateString() },
    { key: "updated_at", label: "Updated Date", formatter: (value) => new Date(value).toLocaleDateString() },
  ];

  const openCreateDialog = () => {
    setEditingBorrower(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormNotes("");
    setDialogOpen(true);
  };

  const openEditDialog = (borrower: Borrower) => {
    setEditingBorrower(borrower);
    setFormName(borrower.name);
    setFormEmail(borrower.email || "");
    setFormPhone(borrower.phone || "");
    setFormNotes(borrower.notes || "");
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

    // Basic email validation
    if (formEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      toast.error("Invalid email address", {
        description: "Please enter a valid email address",
      });
      return;
    }

    try {
      setIsSaving(true);

      if (editingBorrower) {
        // Update existing borrower
        const updateData: BorrowerUpdate = {
          name: formName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          notes: formNotes || undefined,
        };
        await borrowersApi.update(editingBorrower.id, updateData);
        toast.success("Borrower updated successfully");
      } else {
        // Create new borrower
        const createData: BorrowerCreate = {
          name: formName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          notes: formNotes || undefined,
        };
        await borrowersApi.create(createData);
        toast.success("Borrower created successfully");
      }

      setDialogOpen(false);
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save borrower";
      toast.error("Failed to save borrower", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBorrower) return;

    try {
      await borrowersApi.delete(deletingBorrower.id);
      toast.success("Borrower deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingBorrower(null);
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete borrower";
      toast.error("Failed to delete borrower", {
        description: errorMessage,
      });
    }
  };

  // Inline edit handlers
  const handleUpdateField = async (
    borrowerId: string,
    field: keyof BorrowerUpdate,
    value: string
  ) => {
    try {
      await borrowersApi.update(borrowerId, { [field]: value });
      toast.success("Updated successfully");
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update";
      toast.error("Update failed", { description: errorMessage });
      throw error; // Re-throw to keep inline edit in error state
    }
  };

  // Bulk export selected borrowers to CSV
  const handleBulkExport = () => {
    const selectedBorrowers = sortedBorrowers.filter((b) => selectedIds.has(b.id));
    exportToCSV(selectedBorrowers, exportColumns, generateFilename("borrowers-bulk"));
    toast.success(`Exported ${selectedCount} ${selectedCount === 1 ? "borrower" : "borrowers"}`);
    clearSelection();
  };

  // Import borrowers from CSV
  const handleImport = async (file: File): Promise<ImportResult> => {
    if (!workspaceId) {
      throw new Error("No workspace selected");
    }

    try {
      const result = await importExportApi.import(workspaceId, "borrower", file);

      // Refresh the borrowers list after successful import
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

  // Bulk archive selected borrowers
  const handleBulkArchive = async () => {
    if (selectedCount === 0) return;

    try {
      // Archive all selected borrowers (soft delete)
      await Promise.all(
        selectedIdsArray.map((id) => borrowersApi.delete(id))
      );

      toast.success(
        `Archived ${selectedCount} ${selectedCount === 1 ? "borrower" : "borrowers"}`
      );
      clearSelection();
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to archive borrowers";
      toast.error("Failed to archive borrowers", {
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
        <BorrowersTableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Borrowers</h1>
        <p className="text-muted-foreground">
          Manage people who can borrow items from your warehouse
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Borrowers</CardTitle>
              <CardDescription>
                {sortedBorrowers.length} borrower{sortedBorrowers.length !== 1 ? "s" : ""}
                {searchQuery && " matching your search"}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Borrower
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
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
                disabled={sortedBorrowers.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            {/* Borrowers table */}
            {sortedBorrowers.length === 0 ? (
              <EmptyState
                icon={Users}
                title={searchQuery ? "No borrowers found" : "No borrowers yet"}
                description={
                  searchQuery
                    ? "Try adjusting your search"
                    : "Get started by adding your first borrower"
                }
              >
                {!searchQuery && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Borrower
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
                          checked={isAllSelected(sortedBorrowers.map((b) => b.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAll(sortedBorrowers.map((b) => b.id));
                            } else {
                              clearSelection();
                            }
                          }}
                          aria-label="Select all borrowers"
                        />
                      </TableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("name")}
                        onSort={() => requestSort("name")}
                      >
                        Name
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("email")}
                        onSort={() => requestSort("email")}
                      >
                        Email
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("phone")}
                        onSort={() => requestSort("phone")}
                      >
                        Phone
                      </SortableTableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBorrowers.map((borrower) => (
                      <ContextMenu key={borrower.id}>
                        <ContextMenuTrigger asChild>
                          <TableRow>
                        <TableCell>
                          <Checkbox
                            checked={isSelected(borrower.id)}
                            onCheckedChange={() => toggleSelection(borrower.id)}
                            aria-label={`Select ${borrower.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(borrower.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <InlineEditCell
                                value={borrower.name}
                                onSave={(newValue) =>
                                  handleUpdateField(borrower.id, "name", newValue)
                                }
                                className="font-medium"
                                placeholder="Borrower name"
                              />
                              {borrower.notes && (
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {borrower.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                            <InlineEditCell
                              value={borrower.email || ""}
                              onSave={(newValue) =>
                                handleUpdateField(borrower.id, "email", newValue)
                              }
                              type="email"
                              placeholder="Email address"
                              className="text-sm"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <InlineEditCell
                              value={borrower.phone || ""}
                              onSave={(newValue) =>
                                handleUpdateField(borrower.id, "phone", newValue)
                              }
                              type="tel"
                              placeholder="Phone number"
                              className="text-sm"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(borrower)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setDeletingBorrower(borrower);
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
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onClick={() => openEditDialog(borrower)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                            <ContextMenuShortcut>E</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onClick={() => {
                              setDeletingBorrower(borrower);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                            <ContextMenuShortcut>⌫</ContextMenuShortcut>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
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
              loadingText="Loading more borrowers..."
              endText={`Showing all ${sortedBorrowers.length} borrower${sortedBorrowers.length !== 1 ? "s" : ""}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingBorrower ? "Edit Borrower" : "Add New Borrower"}
            </DialogTitle>
            <DialogDescription>
              {editingBorrower
                ? "Update the borrower details below"
                : "Add a new person who can borrow items"}
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
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Additional information about this borrower..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingBorrower ? "Update" : "Create"}
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
              This will delete the borrower "{deletingBorrower?.name}".
              {" "}Note: You cannot delete a borrower with active loans.
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
        data={sortedBorrowers}
        allData={borrowers}
        columns={exportColumns}
        filePrefix="borrowers"
        title="Export Borrowers to CSV"
        description="Select columns and data to export"
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="borrower"
        onImport={handleImport}
        title="Import Borrowers from CSV"
        description="Upload a CSV file to import borrowers. The file should include columns for name, email, phone, and other details."
      />
    </div>
  );
}
