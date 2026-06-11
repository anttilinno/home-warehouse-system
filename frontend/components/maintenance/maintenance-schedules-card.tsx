"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Wrench, Plus, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { maintenanceApi } from "@/lib/api";
import type { MaintenanceSchedule } from "@/lib/types/maintenance";
import type { Inventory } from "@/lib/types/inventory";
import { daysUntil } from "@/lib/expiry";
import { useDateFormat } from "@/lib/hooks/use-date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface MaintenanceSchedulesCardProps {
  workspaceId: string;
  /** Inventory entries of the item being shown. */
  inventoryEntries: Inventory[];
  canEdit: boolean;
}

/**
 * Item-detail section listing recurring maintenance schedules across the
 * item's inventory entries, with create / complete-with-note / delete.
 */
export function MaintenanceSchedulesCard({
  workspaceId,
  inventoryEntries,
  canEdit,
}: MaintenanceSchedulesCardProps) {
  const t = useTranslations("maintenance");
  const { formatDate } = useDateFormat();

  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formIntervalDays, setFormIntervalDays] = useState("90");
  const [formNextDue, setFormNextDue] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Complete dialog state
  const [completeTarget, setCompleteTarget] = useState<MaintenanceSchedule | null>(null);
  const [completeNote, setCompleteNote] = useState("");

  const inventoryIds = inventoryEntries.map((inv) => inv.id);

  const load = useCallback(async () => {
    if (inventoryIds.length === 0) {
      setSchedules([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const results = await Promise.all(
        inventoryIds.map((id) => maintenanceApi.listByInventory(workspaceId, id))
      );
      setSchedules(results.flat());
    } catch {
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, inventoryIds.join(",")]);

  useEffect(() => {
    load();
  }, [load]);

  const resetCreateForm = () => {
    setFormTitle("");
    setFormIntervalDays("90");
    setFormNextDue("");
    setFormNotes("");
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formNextDue || inventoryIds.length === 0) return;
    const intervalDays = parseInt(formIntervalDays, 10);
    if (!Number.isFinite(intervalDays) || intervalDays < 1) {
      toast.error(t("toasts.invalidInterval"));
      return;
    }

    setIsSaving(true);
    try {
      await maintenanceApi.create(workspaceId, {
        inventory_id: inventoryIds[0],
        title: formTitle.trim(),
        notes: formNotes.trim() || undefined,
        interval_days: intervalDays,
        next_due: new Date(formNextDue).toISOString(),
      });
      toast.success(t("toasts.created"));
      setCreateOpen(false);
      resetCreateForm();
      load();
    } catch {
      toast.error(t("toasts.createFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!completeTarget) return;
    setIsSaving(true);
    try {
      await maintenanceApi.complete(workspaceId, completeTarget.id, {
        notes: completeNote.trim() || undefined,
      });
      toast.success(t("toasts.completed"));
      setCompleteTarget(null);
      setCompleteNote("");
      load();
    } catch {
      toast.error(t("toasts.completeFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (schedule: MaintenanceSchedule) => {
    try {
      await maintenanceApi.delete(workspaceId, schedule.id);
      toast.success(t("toasts.deleted"));
      load();
    } catch {
      toast.error(t("toasts.deleteFailed"));
    }
  };

  const dueBadge = (schedule: MaintenanceSchedule) => {
    const days = daysUntil(schedule.next_due);
    if (days === null) return null;
    if (!schedule.is_active) {
      return <Badge variant="outline">{t("inactive")}</Badge>;
    }
    if (days < 0) {
      return <Badge variant="destructive">{t("overdue")}</Badge>;
    }
    if (days <= 7) {
      return (
        <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 hover:bg-amber-100">
          {t("dueSoon")}
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card data-testid="maintenance-schedules-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {t("title")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          {canEdit && inventoryIds.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("add")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {inventoryIds.length === 0 ? t("noInventory") : t("empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between gap-3 rounded-xl border p-3"
                data-testid="maintenance-schedule-row"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{schedule.title}</p>
                    {dueBadge(schedule)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("nextDue", { date: formatDate(schedule.next_due) })}
                    {" · "}
                    {t("everyDays", { days: schedule.interval_days })}
                    {schedule.last_completed_at &&
                      ` · ${t("lastDone", { date: formatDate(schedule.last_completed_at) })}`}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!schedule.is_active}
                      onClick={() => setCompleteTarget(schedule)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {t("complete")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("delete")}
                      onClick={() => handleDelete(schedule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createDialog.title")}</DialogTitle>
            <DialogDescription>{t("createDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maintenance-title">{t("createDialog.titleLabel")}</Label>
              <Input
                id="maintenance-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t("createDialog.titlePlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maintenance-interval">{t("createDialog.intervalLabel")}</Label>
                <Input
                  id="maintenance-interval"
                  type="number"
                  min={1}
                  value={formIntervalDays}
                  onChange={(e) => setFormIntervalDays(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenance-next-due">{t("createDialog.nextDueLabel")}</Label>
                <Input
                  id="maintenance-next-due"
                  type="date"
                  value={formNextDue}
                  onChange={(e) => setFormNextDue(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance-notes">{t("createDialog.notesLabel")}</Label>
              <Textarea
                id="maintenance-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isSaving}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSaving || !formTitle.trim() || !formNextDue}
            >
              {t("createDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete-with-note dialog */}
      <Dialog
        open={completeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCompleteTarget(null);
            setCompleteNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("completeDialog.title")}</DialogTitle>
            <DialogDescription>
              {completeTarget &&
                t("completeDialog.description", { title: completeTarget.title })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="maintenance-complete-note">{t("completeDialog.noteLabel")}</Label>
            <Textarea
              id="maintenance-complete-note"
              value={completeNote}
              onChange={(e) => setCompleteNote(e.target.value)}
              placeholder={t("completeDialog.notePlaceholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCompleteTarget(null);
                setCompleteNote("");
              }}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleComplete} disabled={isSaving}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t("completeDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
