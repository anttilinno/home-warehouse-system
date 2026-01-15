"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  HandCoins,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  User,
  Download,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, parseISO } from "date-fns";

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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfiniteScrollTrigger } from "@/components/ui/infinite-scroll-trigger";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterPopover } from "@/components/ui/filter-popover";
import { ExportDialog } from "@/components/ui/export-dialog";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useFilters } from "@/lib/hooks/use-filters";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { loansApi, borrowersApi, itemsApi, inventoryApi } from "@/lib/api";
import type { Loan } from "@/lib/types/loans";
import type { Borrower } from "@/lib/types/borrowers";
import type { Item } from "@/lib/types/items";
import type { Inventory } from "@/lib/types/inventory";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { exportToCSV, generateFilename, type ColumnDefinition } from "@/lib/utils/csv-export";

interface LoansFilterControlsProps {
  borrowers: Borrower[];
  addFilter: (filter: any) => void;
  getFilter: (key: string) => any;
}

function LoansFilterControls({
  borrowers,
  addFilter,
  getFilter,
}: LoansFilterControlsProps) {
  const [selectedBorrowers, setSelectedBorrowers] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loanedFrom, setLoanedFrom] = useState<Date | null>(null);
  const [loanedTo, setLoanedTo] = useState<Date | null>(null);
  const [dueFrom, setDueFrom] = useState<Date | null>(null);
  const [dueTo, setDueTo] = useState<Date | null>(null);

  // Toggle borrower selection
  const toggleBorrower = (borrowerId: string) => {
    const newSelection = selectedBorrowers.includes(borrowerId)
      ? selectedBorrowers.filter((id) => id !== borrowerId)
      : [...selectedBorrowers, borrowerId];

    setSelectedBorrowers(newSelection);

    if (newSelection.length > 0) {
      addFilter({
        key: "borrowers",
        label: "Borrower",
        value: newSelection,
        type: "multi-select",
      });
    } else {
      addFilter({
        key: "borrowers",
        label: "Borrower",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Toggle status selection
  const toggleStatus = (status: string) => {
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

  // Update overdue filter
  const updateOverdueFilter = (value: boolean) => {
    setOverdueOnly(value);
    if (value) {
      addFilter({
        key: "overdue",
        label: "Overdue Only",
        value: true,
        type: "boolean",
      });
    } else {
      addFilter({
        key: "overdue",
        label: "Overdue Only",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Update loaned date range
  const updateLoanedDateRange = (from: string, to: string) => {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    setLoanedFrom(fromDate);
    setLoanedTo(toDate);

    if (fromDate || toDate) {
      addFilter({
        key: "loanedDate",
        label: "Loaned Date",
        value: { from: fromDate, to: toDate },
        type: "date-range",
      });
    } else {
      addFilter({
        key: "loanedDate",
        label: "Loaned Date",
        value: [],
        type: "multi-select",
      });
    }
  };

  // Update due date range
  const updateDueDateRange = (from: string, to: string) => {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    setDueFrom(fromDate);
    setDueTo(toDate);

    if (fromDate || toDate) {
      addFilter({
        key: "dueDate",
        label: "Due Date",
        value: { from: fromDate, to: toDate },
        type: "date-range",
      });
    } else {
      addFilter({
        key: "dueDate",
        label: "Due Date",
        value: [],
        type: "multi-select",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Borrowers */}
      {borrowers.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Borrowers</Label>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
            {borrowers.map((borrower) => (
              <div key={borrower.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`borrower-${borrower.id}`}
                  checked={selectedBorrowers.includes(borrower.id)}
                  onCheckedChange={() => toggleBorrower(borrower.id)}
                />
                <label
                  htmlFor={`borrower-${borrower.id}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  {borrower.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Status</Label>
        <div className="space-y-2 rounded-md border p-2">
          {["active", "overdue", "returned"].map((status) => (
            <div key={status} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${status}`}
                checked={selectedStatuses.includes(status)}
                onCheckedChange={() => toggleStatus(status)}
              />
              <label
                htmlFor={`status-${status}`}
                className="flex-1 cursor-pointer text-sm capitalize"
              >
                {status}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue Only */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="overdue-only"
          checked={overdueOnly}
          onCheckedChange={(checked) => updateOverdueFilter(!!checked)}
        />
        <label htmlFor="overdue-only" className="cursor-pointer text-sm">
          Show Overdue Only
        </label>
      </div>

      {/* Loaned Date Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Loaned Date</Label>
        <div className="space-y-2">
          <Input
            type="date"
            value={loanedFrom ? format(loanedFrom, "yyyy-MM-dd") : ""}
            onChange={(e) => updateLoanedDateRange(e.target.value, loanedTo ? format(loanedTo, "yyyy-MM-dd") : "")}
            placeholder="From"
          />
          <Input
            type="date"
            value={loanedTo ? format(loanedTo, "yyyy-MM-dd") : ""}
            onChange={(e) => updateLoanedDateRange(loanedFrom ? format(loanedFrom, "yyyy-MM-dd") : "", e.target.value)}
            placeholder="To"
          />
        </div>
      </div>

      {/* Due Date Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Due Date</Label>
        <div className="space-y-2">
          <Input
            type="date"
            value={dueFrom ? format(dueFrom, "yyyy-MM-dd") : ""}
            onChange={(e) => updateDueDateRange(e.target.value, dueTo ? format(dueTo, "yyyy-MM-dd") : "")}
            placeholder="From"
          />
          <Input
            type="date"
            value={dueTo ? format(dueTo, "yyyy-MM-dd") : ""}
            onChange={(e) => updateDueDateRange(dueFrom ? format(dueFrom, "yyyy-MM-dd") : "", e.target.value)}
            placeholder="To"
          />
        </div>
      </div>
    </div>
  );
}

function LoansTableSkeleton() {
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
              <TableHead>Status</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Inventory ID</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Loaned</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function LoanStatusBadge({ loan }: { loan: Loan }) {
  if (!loan.is_active) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        <span>Returned</span>
      </Badge>
    );
  }

  if (loan.is_overdue) {
    return (
      <Badge variant="destructive" className="gap-1.5">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        <span>Overdue</span>
      </Badge>
    );
  }

  return (
    <Badge className="gap-1.5 bg-blue-500">
      <Clock className="h-3 w-3" aria-hidden="true" />
      <span>Active</span>
    </Badge>
  );
}

export default function LoansPage() {
  const t = useTranslations("loans");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [availableInventory, setAvailableInventory] = useState<Inventory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returningLoan, setReturningLoan] = useState<Loan | null>(null);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [extendingLoan, setExtendingLoan] = useState<Loan | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Create loan form state
  const [formItemId, setFormItemId] = useState("");
  const [formInventoryId, setFormInventoryId] = useState("");
  const [formBorrowerId, setFormBorrowerId] = useState("");
  const [formQuantity, setFormQuantity] = useState(1);
  const [formLoanedAt, setFormLoanedAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Infinite scroll for loans
  const {
    items: loans,
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
      return await loansApi.list({ page, limit: 50 });
    },
    pageSize: 50,
    dependencies: [workspaceId],
    autoFetch: !!workspaceId,
  });

  // Load borrowers
  const loadBorrowers = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const data = await borrowersApi.list({ limit: 500 });
      setBorrowers(data.items.filter(b => !b.is_archived));
    } catch (error) {
      console.error("Failed to load borrowers:", error);
    }
  }, [workspaceId]);

  // Load items
  const loadItems = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const response = await itemsApi.list({ limit: 500 });
      setItems(response.items.filter(item => !item.is_archived));
    } catch (error) {
      console.error("Failed to load items:", error);
    }
  }, [workspaceId]);

  // Load available inventory for selected item
  const loadAvailableInventory = useCallback(async (itemId: string) => {
    if (!workspaceId || !itemId) {
      setAvailableInventory([]);
      return;
    }

    try {
      const data = await inventoryApi.getAvailable(itemId);
      setAvailableInventory(data);
    } catch (error) {
      console.error("Failed to load available inventory:", error);
      setAvailableInventory([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      loadBorrowers();
      loadItems();
    }
  }, [workspaceId, loadBorrowers, loadItems]);

  // Load inventory when item changes
  useEffect(() => {
    if (formItemId) {
      loadAvailableInventory(formItemId);
    } else {
      setAvailableInventory([]);
      setFormInventoryId("");
    }
  }, [formItemId, loadAvailableInventory]);

  // Filter loans - memoized for performance
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const borrower = borrowers.find(b => b.id === loan.borrower_id);
        const matchesSearch =
          loan.inventory_id.toLowerCase().includes(query) ||
          borrower?.name.toLowerCase().includes(query) ||
          loan.notes?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filter by borrowers (multi-select)
      const borrowersFilter = getFilter("borrowers");
      if (borrowersFilter && Array.isArray(borrowersFilter.value)) {
        if (!borrowersFilter.value.includes(loan.borrower_id)) {
          return false;
        }
      }

      // Filter by statuses (multi-select)
      const statusesFilter = getFilter("statuses");
      if (statusesFilter && Array.isArray(statusesFilter.value)) {
        const statuses = statusesFilter.value;
        if (statuses.includes("active") && !loan.is_active) return false;
        if (statuses.includes("overdue") && !loan.is_overdue) return false;
        if (statuses.includes("returned") && loan.is_active) return false;
        // If none of the selected statuses match, filter out
        const matchesStatus =
          (statuses.includes("active") && loan.is_active && !loan.is_overdue) ||
          (statuses.includes("overdue") && loan.is_overdue) ||
          (statuses.includes("returned") && !loan.is_active);
        if (!matchesStatus) return false;
      }

      // Filter by overdue only
      const overdueFilter = getFilter("overdue");
      if (overdueFilter && typeof overdueFilter.value === "boolean" && overdueFilter.value) {
        if (!loan.is_overdue) return false;
      }

      // Filter by loaned date range
      const loanedDateFilter = getFilter("loanedDate");
      if (loanedDateFilter && typeof loanedDateFilter.value === "object") {
        const range = loanedDateFilter.value as { from: Date | null; to: Date | null };
        const loanedDate = new Date(loan.loaned_at);
        if (range.from && loanedDate < range.from) return false;
        if (range.to && loanedDate > range.to) return false;
      }

      // Filter by due date range
      const dueDateFilter = getFilter("dueDate");
      if (dueDateFilter && typeof dueDateFilter.value === "object") {
        const range = dueDateFilter.value as { from: Date | null; to: Date | null };
        if (!loan.due_date) return false;
        const dueDate = new Date(loan.due_date);
        if (range.from && dueDate < range.from) return false;
        if (range.to && dueDate > range.to) return false;
      }

      return true;
    });
  }, [loans, searchQuery, borrowers, activeFilters]);

  // Flatten loan data for sorting (add borrower name)
  const flattenedLoans = useMemo(() => {
    return filteredLoans.map(loan => ({
      ...loan,
      borrower_name: getBorrowerName(loan.borrower_id),
    }));
  }, [filteredLoans, borrowers]);

  // Sort loans
  const { sortedData: sortedLoans, requestSort, getSortDirection } = useTableSort(flattenedLoans, "loaned_at", "desc");

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
        description: 'Create new loan',
        action: () => setCreateDialogOpen(true),
      },
      {
        key: 'r',
        description: 'Refresh loans list',
        action: () => refetch(),
        preventDefault: false,
      },
      {
        key: 'a',
        ctrl: true,
        description: 'Select all loans',
        action: () => {
          if (sortedLoans.length > 0) {
            selectAll(sortedLoans.map((l) => l.id));
          }
        },
      },
      {
        key: 'Escape',
        description: 'Clear selection or close dialog',
        action: () => {
          if (selectedCount > 0) {
            clearSelection();
          }
        },
        preventDefault: false,
      },
    ],
    enabled: true,
    ignoreInputFields: true,
  });

  const getBorrowerName = (borrowerId: string) => {
    const borrower = borrowers.find((b) => b.id === borrowerId);
    return borrower?.name || "Unknown";
  };

  // Export columns definition
  const exportColumns: ColumnDefinition<Loan>[] = useMemo(() => [
    { key: "borrower_id", label: "Borrower", formatter: (_, loan) => getBorrowerName(loan.borrower_id) },
    { key: "inventory_id", label: "Inventory ID" },
    { key: "quantity", label: "Quantity" },
    { key: "loaned_date", label: "Loaned Date", formatter: (value) => format(parseISO(value), "yyyy-MM-dd") },
    { key: "due_date", label: "Due Date", formatter: (value) => format(parseISO(value), "yyyy-MM-dd") },
    { key: "returned_date", label: "Returned Date", formatter: (value) => value ? format(parseISO(value), "yyyy-MM-dd") : "Not returned" },
    { key: "notes", label: "Notes" },
    { key: "created_at", label: "Created Date", formatter: (value) => new Date(value).toLocaleDateString() },
  ], [borrowers]);

  const handleReturn = async () => {
    if (!returningLoan) return;

    try {
      setIsProcessing(true);
      await loansApi.return(returningLoan.id);
      toast.success("Loan returned successfully");
      setReturnDialogOpen(false);
      setReturningLoan(null);
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to return loan";
      toast.error("Failed to return loan", {
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk export selected loans to CSV
  const handleBulkExport = () => {
    const selectedLoans = sortedLoans.filter((loan) => selectedIds.has(loan.id));
    exportToCSV(selectedLoans, exportColumns, generateFilename("loans-bulk"));
    toast.success(`Exported ${selectedCount} ${selectedCount === 1 ? "loan" : "loans"}`);
    clearSelection();
  };

  // Bulk return selected loans
  const handleBulkReturn = async () => {
    if (selectedCount === 0) return;

    try {
      // Return all selected loans
      await Promise.all(
        selectedIdsArray.map((id) => loansApi.return(id))
      );

      toast.success(
        `Returned ${selectedCount} ${selectedCount === 1 ? "loan" : "loans"}`
      );
      clearSelection();
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to return loans";
      toast.error("Failed to return loans", {
        description: errorMessage,
      });
    }
  };

  const handleExtend = async () => {
    if (!extendingLoan || !newDueDate) return;

    try {
      setIsProcessing(true);
      await loansApi.extend(extendingLoan.id, { new_due_date: newDueDate });
      toast.success("Due date extended successfully");
      setExtendDialogOpen(false);
      setExtendingLoan(null);
      setNewDueDate("");
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to extend due date";
      toast.error("Failed to extend due date", {
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCreateForm = () => {
    setFormItemId("");
    setFormInventoryId("");
    setFormBorrowerId("");
    setFormQuantity(1);
    setFormLoanedAt(format(new Date(), "yyyy-MM-dd"));
    setFormDueDate("");
    setFormNotes("");
  };

  const handleCreateLoan = async () => {
    if (!formInventoryId || !formBorrowerId) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsProcessing(true);
      await loansApi.create({
        inventory_id: formInventoryId,
        borrower_id: formBorrowerId,
        quantity: formQuantity,
        loaned_at: new Date(formLoanedAt).toISOString(),
        due_date: formDueDate ? new Date(formDueDate).toISOString() : undefined,
        notes: formNotes || undefined,
      });
      toast.success("Loan created successfully");
      setCreateDialogOpen(false);
      resetCreateForm();
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create loan";
      toast.error("Failed to create loan", {
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (workspaceLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <LoansTableSkeleton />
      </div>
    );
  }

  const activeCount = loans.filter(l => l.is_active).length;
  const overdueCount = loans.filter(l => l.is_overdue).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
        <p className="text-muted-foreground">
          Track borrowed items and manage returns
        </p>
      </div>

      {/* Stats */}
      {loans.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Loans</CardDescription>
              <CardTitle className="text-3xl">{activeCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Overdue</CardDescription>
              <CardTitle className="text-3xl text-destructive">{overdueCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Returned</CardDescription>
              <CardTitle className="text-3xl">{loans.length - activeCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Loan History</CardTitle>
              <CardDescription>
                {sortedLoans.length} loan{sortedLoans.length !== 1 ? "s" : ""}
                {searchQuery && " matching your search"}
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Loan
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
                  placeholder="Search by borrower or inventory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <FilterPopover activeFilterCount={activeFilterCount}>
                <LoansFilterControls
                  borrowers={borrowers}
                  addFilter={addFilter}
                  getFilter={getFilter}
                />
              </FilterPopover>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportDialogOpen(true)}
                disabled={filteredLoans.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
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

            {/* Loans table */}
            {sortedLoans.length === 0 ? (
              <EmptyState
                icon={HandCoins}
                title={searchQuery || activeFilterCount > 0 ? "No loans found" : "No loans yet"}
                description={
                  searchQuery || activeFilterCount > 0
                    ? "Try adjusting your search or filters"
                    : "Start tracking borrowed items by creating a loan"
                }
              >
                {!searchQuery && activeFilterCount === 0 && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Loan
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="rounded-lg border">
                <Table aria-label="Borrowed items and loans">
                  <caption className="sr-only">
                    List of borrowed items with borrower, inventory details, loan dates, and status information.
                    Currently showing {sortedLoans.length} {sortedLoans.length === 1 ? "loan" : "loans"}.
                  </caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllSelected(sortedLoans.map((l) => l.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAll(sortedLoans.map((l) => l.id));
                            } else {
                              clearSelection();
                            }
                          }}
                          aria-label="Select all loans"
                        />
                      </TableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("is_active")}
                        onSort={() => requestSort("is_active")}
                      >
                        Status
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("borrower_name")}
                        onSort={() => requestSort("borrower_name")}
                      >
                        Borrower
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("inventory_id")}
                        onSort={() => requestSort("inventory_id")}
                      >
                        Inventory ID
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("quantity")}
                        onSort={() => requestSort("quantity")}
                      >
                        Qty
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("loaned_at")}
                        onSort={() => requestSort("loaned_at")}
                      >
                        Loaned
                      </SortableTableHead>
                      <SortableTableHead
                        sortDirection={getSortDirection("due_date")}
                        onSort={() => requestSort("due_date")}
                      >
                        Due
                      </SortableTableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLoans.map((loan) => (
                      <TableRow key={loan.id} className={cn(loan.is_overdue && "bg-destructive/5")}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected(loan.id)}
                            onCheckedChange={() => toggleSelection(loan.id)}
                            aria-label={`Select loan for ${getBorrowerName(loan.borrower_id)}`}
                          />
                        </TableCell>
                        <TableCell>
                          <LoanStatusBadge loan={loan} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {getBorrowerName(loan.borrower_id)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">{loan.inventory_id}</div>
                          {loan.notes && (
                            <div className="text-sm text-muted-foreground line-clamp-1 mt-1">
                              {loan.notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{loan.quantity}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(parseISO(loan.loaned_at), "MMM d, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {loan.due_date ? (
                            <div className={cn(
                              "text-sm flex items-center gap-1",
                              loan.is_overdue && "text-destructive font-medium"
                            )}>
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(loan.due_date), "MMM d, yyyy")}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={!loan.is_active} aria-label={`Actions for loan to ${getBorrowerName(loan.borrower_id)}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setReturningLoan(loan);
                                  setReturnDialogOpen(true);
                                }}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Mark as Returned
                              </DropdownMenuItem>
                              {loan.due_date && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setExtendingLoan(loan);
                                      setNewDueDate(loan.due_date || "");
                                      setExtendDialogOpen(true);
                                    }}
                                  >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Extend Due Date
                                  </DropdownMenuItem>
                                </>
                              )}
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
              loadingText="Loading more loans..."
              endText={`Showing all ${sortedLoans.length} loan${sortedLoans.length !== 1 ? "s" : ""}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Return Confirmation Dialog */}
      <AlertDialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return Loan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this loan as returned? This will update the inventory status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturn} disabled={isProcessing}>
              {isProcessing ? "Returning..." : "Confirm Return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extend Due Date Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Due Date</DialogTitle>
            <DialogDescription>
              Set a new due date for this loan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_due_date">New Due Date</Label>
              <Input
                id="new_due_date"
                type="date"
                value={newDueDate ? format(parseISO(newDueDate), "yyyy-MM-dd") : ""}
                onChange={(e) => setNewDueDate(e.target.value ? new Date(e.target.value).toISOString() : "")}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtend} disabled={isProcessing || !newDueDate}>
              {isProcessing ? "Saving..." : "Extend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Loan Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Loan</DialogTitle>
            <DialogDescription>
              Select an item and borrower to create a new loan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Item Selection */}
            <div className="space-y-2">
              <Label htmlFor="item">Item *</Label>
              <Select value={formItemId} onValueChange={setFormItemId}>
                <SelectTrigger id="item">
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} {item.sku && `(${item.sku})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Inventory Selection */}
            {formItemId && (
              <div className="space-y-2">
                <Label htmlFor="inventory">Available Inventory *</Label>
                <Select value={formInventoryId} onValueChange={setFormInventoryId}>
                  <SelectTrigger id="inventory">
                    <SelectValue placeholder={
                      availableInventory.length === 0
                        ? "No available inventory"
                        : "Select inventory"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInventory.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.condition} - Qty: {inv.quantity}
                        {inv.notes && ` (${inv.notes.substring(0, 30)}...)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableInventory.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No available inventory for this item
                  </p>
                )}
              </div>
            )}

            {/* Borrower Selection */}
            <div className="space-y-2">
              <Label htmlFor="borrower">Borrower *</Label>
              <Select value={formBorrowerId} onValueChange={setFormBorrowerId}>
                <SelectTrigger id="borrower">
                  <SelectValue placeholder="Select a borrower" />
                </SelectTrigger>
                <SelectContent>
                  {borrowers.map((borrower) => (
                    <SelectItem key={borrower.id} value={borrower.id}>
                      {borrower.name}
                      {borrower.email && ` (${borrower.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={availableInventory.find(inv => inv.id === formInventoryId)?.quantity || 1}
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
                />
                {formInventoryId && (
                  <p className="text-xs text-muted-foreground">
                    Max: {availableInventory.find(inv => inv.id === formInventoryId)?.quantity || 0}
                  </p>
                )}
              </div>

              {/* Loaned Date */}
              <div className="space-y-2">
                <Label htmlFor="loaned_at">Loaned Date *</Label>
                <Input
                  id="loaned_at"
                  type="date"
                  value={formLoanedAt}
                  onChange={(e) => setFormLoanedAt(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                min={formLoanedAt || format(new Date(), "yyyy-MM-dd")}
              />
              <p className="text-xs text-muted-foreground">
                Optional - leave empty for no due date
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Add any notes about this loan..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateLoan}
              disabled={isProcessing || !formInventoryId || !formBorrowerId || availableInventory.length === 0}
            >
              {isProcessing ? "Creating..." : "Create Loan"}
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
        <Button onClick={handleBulkReturn} size="sm" variant="outline">
          <Undo2 className="mr-2 h-4 w-4" />
          Mark as Returned
        </Button>
      </BulkActionBar>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        data={sortedLoans}
        allData={loans}
        columns={exportColumns}
        filePrefix="loans"
        title="Export Loans to CSV"
        description="Select columns and data to export"
      />
    </div>
  );
}
