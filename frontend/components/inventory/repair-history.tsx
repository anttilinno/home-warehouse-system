"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Wrench,
  Play,
  CheckCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
  DollarSign,
  Building,
  Calendar,
  Shield,
  Bell,
  Image,
  Paperclip,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

import { repairLogsApi } from "@/lib/api";
import type { RepairLog, RepairLogCreate, RepairStatus, RepairPhoto, RepairAttachment, RepairCostSummary } from "@/lib/types/repair-log";
import type { InventoryCondition } from "@/lib/types/inventory";
import { cn } from "@/lib/utils";
import { RepairPhotoUpload } from "./repair-photo-upload";
import { RepairAttachments } from "./repair-attachments";

const CONDITION_OPTIONS: { value: InventoryCondition; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "FOR_REPAIR", label: "For Repair" },
];

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
];

const STATUS_CONFIG: Record<RepairStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING: { label: "Pending", color: "bg-yellow-500", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-500", icon: Wrench },
  COMPLETED: { label: "Completed", color: "bg-green-500", icon: CheckCircle },
};

interface RepairHistoryProps {
  inventoryId: string;
  workspaceId: string;
  onRepairComplete?: (newCondition?: string) => void;
}

function StatusBadge({ status }: { status: RepairStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge className={cn("gap-1.5", config.color)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}

function formatCurrency(amountCents: number | null, currencyCode: string | null): string {
  if (amountCents === null) return "-";
  const amount = amountCents / 100;
  const code = currencyCode || "EUR";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
  }).format(amount);
}

export function RepairHistory({ inventoryId, workspaceId, onRepairComplete }: RepairHistoryProps) {
  const t = useTranslations("repairs");

  // State
  const [repairs, setRepairs] = useState<RepairLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<RepairLog | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cost summary state
  const [costSummary, setCostSummary] = useState<RepairCostSummary[]>([]);

  // Detail dialog state
  const [repairPhotos, setRepairPhotos] = useState<RepairPhoto[]>([]);
  const [repairAttachments, setRepairAttachments] = useState<RepairAttachment[]>([]);
  const [photosExpanded, setPhotosExpanded] = useState(true);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);

  // Create form state
  const [formDescription, setFormDescription] = useState("");
  const [formRepairDate, setFormRepairDate] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formCurrencyCode, setFormCurrencyCode] = useState("EUR");
  const [formServiceProvider, setFormServiceProvider] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formIsWarrantyClaim, setFormIsWarrantyClaim] = useState(false);
  const [formReminderDate, setFormReminderDate] = useState("");

  // Complete form state
  const [completeNewCondition, setCompleteNewCondition] = useState<string>("");

  // Fetch repairs
  const fetchRepairs = useCallback(async () => {
    try {
      setLoading(true);
      const [repairsData, costData] = await Promise.all([
        repairLogsApi.listByInventory(workspaceId, inventoryId),
        repairLogsApi.getRepairCost(workspaceId, inventoryId),
      ]);
      setRepairs(repairsData);
      setCostSummary(costData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load repairs";
      toast.error(t("error"), { description: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, inventoryId, t]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  // Fetch photos and attachments for selected repair
  const fetchRepairDetails = useCallback(async (repair: RepairLog) => {
    try {
      const [photos, attachments] = await Promise.all([
        repairLogsApi.listPhotos(workspaceId, repair.id),
        repairLogsApi.listAttachments(workspaceId, repair.id),
      ]);
      setRepairPhotos(photos);
      setRepairAttachments(attachments);
    } catch (error) {
      console.error("Failed to fetch repair details:", error);
    }
  }, [workspaceId]);

  // Reset form
  const resetForm = () => {
    setFormDescription("");
    setFormRepairDate("");
    setFormCost("");
    setFormCurrencyCode("EUR");
    setFormServiceProvider("");
    setFormNotes("");
    setFormIsWarrantyClaim(false);
    setFormReminderDate("");
  };

  // Open detail dialog
  const openDetailDialog = async (repair: RepairLog) => {
    setSelectedRepair(repair);
    setDetailDialogOpen(true);
    setPhotosExpanded(true);
    setAttachmentsExpanded(false);
    await fetchRepairDetails(repair);
  };

  // Create repair
  const handleCreate = async () => {
    if (!formDescription.trim()) {
      toast.error(t("error"), { description: "Description is required" });
      return;
    }

    try {
      setIsSaving(true);
      const data: RepairLogCreate = {
        inventory_id: inventoryId,
        description: formDescription.trim(),
      };

      if (formRepairDate) {
        data.repair_date = formRepairDate;
      }
      if (formCost) {
        const costCents = Math.round(parseFloat(formCost) * 100);
        if (!isNaN(costCents) && costCents > 0) {
          data.cost = costCents;
          data.currency_code = formCurrencyCode;
        }
      }
      if (formServiceProvider.trim()) {
        data.service_provider = formServiceProvider.trim();
      }
      if (formNotes.trim()) {
        data.notes = formNotes.trim();
      }
      if (formIsWarrantyClaim) {
        data.is_warranty_claim = true;
      }
      if (formReminderDate) {
        data.reminder_date = formReminderDate;
      }

      await repairLogsApi.create(workspaceId, data);
      toast.success(t("createSuccess"));
      setCreateDialogOpen(false);
      resetForm();
      fetchRepairs();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create repair";
      toast.error(t("error"), { description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  // Start repair
  const handleStart = async (repair: RepairLog) => {
    try {
      await repairLogsApi.start(workspaceId, repair.id);
      toast.success(t("startSuccess"));
      fetchRepairs();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start repair";
      toast.error(t("error"), { description: errorMessage });
    }
  };

  // Complete repair
  const handleComplete = async () => {
    if (!selectedRepair) return;

    try {
      setIsSaving(true);
      await repairLogsApi.complete(
        workspaceId,
        selectedRepair.id,
        completeNewCondition ? { new_condition: completeNewCondition } : undefined
      );
      toast.success(t("completeSuccess"));
      setCompleteDialogOpen(false);
      setSelectedRepair(null);
      setCompleteNewCondition("");
      fetchRepairs();

      // Notify parent of completion to refresh inventory
      if (onRepairComplete) {
        onRepairComplete(completeNewCondition || undefined);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to complete repair";
      toast.error(t("error"), { description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete repair
  const handleDelete = async () => {
    if (!selectedRepair) return;

    try {
      setIsSaving(true);
      await repairLogsApi.delete(workspaceId, selectedRepair.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setSelectedRepair(null);
      fetchRepairs();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete repair";
      toast.error(t("error"), { description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  // Open complete dialog
  const openCompleteDialog = (repair: RepairLog) => {
    setSelectedRepair(repair);
    setCompleteNewCondition("");
    setCompleteDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (repair: RepairLog) => {
    setSelectedRepair(repair);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("add")}
        </Button>
      </div>

      {/* Lifecycle Cost Summary */}
      {costSummary.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("totalCost")}:</span>
              <div className="flex flex-wrap gap-2">
                {costSummary.map((summary) => (
                  <Badge key={summary.currency_code} variant="secondary">
                    {formatCurrency(summary.total_cents, summary.currency_code)} ({summary.repair_count} {summary.repair_count === 1 ? "repair" : "repairs"})
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {repairs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t("noRepairs")}
          description={t("noRepairsDescription")}
        >
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("add")}
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("cost")}</TableHead>
                <TableHead>{t("serviceProvider")}</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repairs.map((repair) => (
                <TableRow key={repair.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetailDialog(repair)}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{repair.description}</span>
                          {repair.is_warranty_claim && (
                            <Badge variant="outline" className="text-purple-600 border-purple-600">
                              <Shield className="h-3 w-3 mr-1" />
                              {t("warrantyClaim")}
                            </Badge>
                          )}
                          {repair.reminder_date && (
                            <Badge variant="outline" className="text-orange-600 border-orange-600">
                              <Bell className="h-3 w-3 mr-1" />
                              {format(parseISO(repair.reminder_date), "PP")}
                            </Badge>
                          )}
                        </div>
                        {repair.notes && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {repair.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={repair.status} />
                  </TableCell>
                  <TableCell>
                    {repair.repair_date
                      ? format(parseISO(repair.repair_date), "PP")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(repair.cost, repair.currency_code)}
                  </TableCell>
                  <TableCell>
                    {repair.service_provider || "-"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {repair.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStart(repair)}
                          title={t("startRepair")}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {repair.status === "IN_PROGRESS" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openCompleteDialog(repair)}
                          title={t("completeRepair")}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetailDialog(repair)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(repair)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Repair Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("add")}</DialogTitle>
            <DialogDescription>
              Create a new repair entry for this inventory item.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">
                {t("description")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe the repair needed..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="repairDate">{t("date")}</Label>
                <Input
                  id="repairDate"
                  type="date"
                  value={formRepairDate}
                  onChange={(e) => setFormRepairDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceProvider">{t("serviceProvider")}</Label>
                <Input
                  id="serviceProvider"
                  value={formServiceProvider}
                  onChange={(e) => setFormServiceProvider(e.target.value)}
                  placeholder="Repair shop name..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">{t("cost")}</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formCost}
                  onChange={(e) => setFormCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={formCurrencyCode} onValueChange={setFormCurrencyCode}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="warrantyClaimCreate"
                  checked={formIsWarrantyClaim}
                  onCheckedChange={(checked) => setFormIsWarrantyClaim(checked === true)}
                />
                <Label htmlFor="warrantyClaimCreate" className="text-sm font-normal cursor-pointer">
                  <Shield className="h-4 w-4 inline mr-1" />
                  {t("warrantyClaim")}
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminderDate">{t("reminderDate")}</Label>
                <Input
                  id="reminderDate"
                  type="date"
                  value={formReminderDate}
                  onChange={(e) => setFormReminderDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Repair Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("completeRepair")}</DialogTitle>
            <DialogDescription>
              Mark this repair as completed. Optionally update the item condition.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newCondition">{t("newCondition")}</Label>
              <Select value={completeNewCondition} onValueChange={setCompleteNewCondition}>
                <SelectTrigger id="newCondition">
                  <SelectValue placeholder="Keep current condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keep current condition</SelectItem>
                  {CONDITION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                If selected, the inventory item condition will be updated.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={isSaving}>
              {isSaving ? "Completing..." : "Complete Repair"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Repair Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this repair entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Repair Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {selectedRepair?.description}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              {selectedRepair && <StatusBadge status={selectedRepair.status} />}
              {selectedRepair?.is_warranty_claim && (
                <Badge variant="outline" className="text-purple-600 border-purple-600">
                  <Shield className="h-3 w-3 mr-1" />
                  {t("warrantyClaim")}
                </Badge>
              )}
              {selectedRepair?.reminder_date && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  <Bell className="h-3 w-3 mr-1" />
                  {format(parseISO(selectedRepair.reminder_date), "PP")}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedRepair && (
            <div className="space-y-4 py-4">
              {/* Repair Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("date")}:</span>
                  <span className="ml-2 font-medium">
                    {selectedRepair.repair_date ? format(parseISO(selectedRepair.repair_date), "PP") : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("cost")}:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(selectedRepair.cost, selectedRepair.currency_code)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("serviceProvider")}:</span>
                  <span className="ml-2 font-medium">{selectedRepair.service_provider || "-"}</span>
                </div>
                {selectedRepair.new_condition && (
                  <div>
                    <span className="text-muted-foreground">{t("newCondition")}:</span>
                    <span className="ml-2 font-medium">{selectedRepair.new_condition}</span>
                  </div>
                )}
              </div>

              {selectedRepair.notes && (
                <div>
                  <span className="text-sm text-muted-foreground">{t("notes")}:</span>
                  <p className="mt-1 text-sm">{selectedRepair.notes}</p>
                </div>
              )}

              {/* Photos Section */}
              <div className="border rounded-lg">
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 h-auto"
                  onClick={() => setPhotosExpanded(!photosExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    <span className="font-medium">{t("photos")}</span>
                    <Badge variant="secondary" className="ml-1">{repairPhotos.length}</Badge>
                  </div>
                  {photosExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {photosExpanded && (
                  <div className="p-3 pt-0 border-t">
                    <RepairPhotoUpload
                      workspaceId={workspaceId}
                      repairLogId={selectedRepair.id}
                      photos={repairPhotos}
                      onPhotosChange={() => fetchRepairDetails(selectedRepair)}
                    />
                  </div>
                )}
              </div>

              {/* Attachments Section */}
              <div className="border rounded-lg">
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 h-auto"
                  onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    <span className="font-medium">{t("attachments")}</span>
                    <Badge variant="secondary" className="ml-1">{repairAttachments.length}</Badge>
                  </div>
                  {attachmentsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {attachmentsExpanded && (
                  <div className="p-3 pt-0 border-t">
                    <RepairAttachments
                      workspaceId={workspaceId}
                      repairLogId={selectedRepair.id}
                      attachments={repairAttachments}
                      onAttachmentsChange={() => fetchRepairDetails(selectedRepair)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
