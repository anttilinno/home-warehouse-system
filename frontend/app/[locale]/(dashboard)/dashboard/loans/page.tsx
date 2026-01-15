"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { loansApi, borrowersApi } from "@/lib/api";
import type { Loan } from "@/lib/types/loans";
import type { Borrower } from "@/lib/types/borrowers";
import { cn } from "@/lib/utils";

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
      <Badge variant="outline" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Returned
      </Badge>
    );
  }

  if (loan.is_overdue) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Overdue
      </Badge>
    );
  }

  return (
    <Badge className="gap-1 bg-blue-500">
      <Clock className="h-3 w-3" />
      Active
    </Badge>
  );
}

export default function LoansPage() {
  const t = useTranslations("loans");
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog state
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returningLoan, setReturningLoan] = useState<Loan | null>(null);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendingLoan, setExtendingLoan] = useState<Loan | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Load loans
  const loadLoans = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      const data = await loansApi.list({ limit: 500 });
      setLoans(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load loans";
      toast.error("Failed to load loans", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Load borrowers
  const loadBorrowers = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const data = await borrowersApi.list({ limit: 500 });
      setBorrowers(data.filter(b => !b.is_archived));
    } catch (error) {
      console.error("Failed to load borrowers:", error);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      loadLoans();
      loadBorrowers();
    }
  }, [workspaceId, loadLoans, loadBorrowers]);

  // Filter loans
  const filteredLoans = loans.filter((loan) => {
    // Filter by status
    if (statusFilter === "active" && !loan.is_active) return false;
    if (statusFilter === "overdue" && !loan.is_overdue) return false;
    if (statusFilter === "returned" && loan.is_active) return false;

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

    return true;
  });

  const getBorrowerName = (borrowerId: string) => {
    const borrower = borrowers.find((b) => b.id === borrowerId);
    return borrower?.name || "Unknown";
  };

  const handleReturn = async () => {
    if (!returningLoan) return;

    try {
      setIsProcessing(true);
      await loansApi.return(returningLoan.id);
      toast.success("Loan returned successfully");
      setReturnDialogOpen(false);
      setReturningLoan(null);
      loadLoans();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to return loan";
      toast.error("Failed to return loan", {
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
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
      loadLoans();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to extend due date";
      toast.error("Failed to extend due date", {
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
                {filteredLoans.length} loan{filteredLoans.length !== 1 ? "s" : ""}
                {searchQuery && " matching your search"}
              </CardDescription>
            </div>
            <Button onClick={() => toast.info("Loan creation requires inventory management to be set up first")}>
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
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Loans table */}
            {filteredLoans.length === 0 ? (
              <EmptyState
                icon={HandCoins}
                title={searchQuery || statusFilter !== "all" ? "No loans found" : "No loans yet"}
                description={
                  searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Start tracking borrowed items by creating a loan"
                }
              >
                {!searchQuery && statusFilter === "all" && (
                  <Button onClick={() => toast.info("Loan creation requires inventory management to be set up first")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Loan
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Inventory ID</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Loaned</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan) => (
                      <TableRow key={loan.id} className={cn(loan.is_overdue && "bg-destructive/5")}>
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
                              <Button variant="ghost" size="icon" disabled={!loan.is_active}>
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
    </div>
  );
}
