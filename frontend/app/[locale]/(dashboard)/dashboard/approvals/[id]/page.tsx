"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  MapPin,
  Box,
  FolderTree,
  Users,
  HandCoins,
  Archive,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useWorkspace } from "@/lib/hooks/use-workspace";
import {
  pendingChangesApi,
  type PendingChange,
  type PendingChangeStatus,
  type PendingChangeEntityType,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const entityTypeIcons: Record<PendingChangeEntityType, typeof Package> = {
  item: Package,
  location: MapPin,
  container: Box,
  category: FolderTree,
  borrower: Users,
  loan: HandCoins,
  inventory: Archive,
};

function getStatusColor(status: PendingChangeStatus): string {
  switch (status) {
    case "pending":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "approved":
      return "bg-green-500/10 text-green-700 border-green-500/20";
    case "rejected":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
}

function getActionLabel(action: string): string {
  switch (action) {
    case "create":
      return "Create";
    case "update":
      return "Update";
    case "delete":
      return "Delete";
    default:
      return action;
  }
}

interface PayloadDiffProps {
  payload: Record<string, unknown>;
  action: string;
}

function PayloadDiff({ payload, action }: PayloadDiffProps) {
  const t = useTranslations("approvals");

  // For create/delete, just show the payload as-is
  if (action === "create" || action === "delete") {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">{t("payload.data")}</h4>
        <div className="bg-muted rounded-lg p-4 font-mono text-xs overflow-x-auto">
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </div>
      </div>
    );
  }

  // For updates, we could show a diff if old_data is included in payload
  // For now, just show the payload
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">{t("payload.changes")}</h4>
      <div className="bg-muted rounded-lg p-4 font-mono text-xs overflow-x-auto">
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </div>
      <p className="text-xs text-muted-foreground">{t("payload.note")}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-muted rounded animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-8 w-1/3 bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-64 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function ApprovalDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations("approvals");
  const router = useRouter();
  const { workspaceId, currentMember } = useWorkspace();

  const [change, setChange] = useState<PendingChange | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Check if user has permission to approve (owner or admin)
  const canApprove = currentMember?.role === "owner" || currentMember?.role === "admin";

  const loadChange = async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      const data = await pendingChangesApi.get(workspaceId, params.id);
      setChange(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load pending change";
      toast.error("Failed to load pending change", {
        description: errorMessage,
      });
      router.push("/dashboard/approvals");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      loadChange();
    }
  }, [workspaceId, params.id]);

  const handleApprove = async () => {
    if (!workspaceId || !change) return;

    setIsApproving(true);
    try {
      await pendingChangesApi.approve(workspaceId, change.id);
      toast.success(t("approveSuccess"), {
        description: t("approveSuccessDescription"),
      });
      router.push("/dashboard/approvals");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to approve change";
      toast.error(t("approveError"), {
        description: errorMessage,
      });
    } finally {
      setIsApproving(false);
      setApproveDialogOpen(false);
    }
  };

  const handleReject = async () => {
    if (!workspaceId || !change || !rejectionReason.trim()) return;

    setIsRejecting(true);
    try {
      await pendingChangesApi.reject(workspaceId, change.id, {
        reason: rejectionReason.trim(),
      });
      toast.success(t("rejectSuccess"), {
        description: t("rejectSuccessDescription"),
      });
      router.push("/dashboard/approvals");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject change";
      toast.error(t("rejectError"), {
        description: errorMessage,
      });
    } finally {
      setIsRejecting(false);
      setRejectDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
        <DetailSkeleton />
      </div>
    );
  }

  if (!change) {
    return null;
  }

  const Icon = entityTypeIcons[change.entity_type];
  const isPending = change.status === "pending";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("back")}
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("capitalize", getStatusColor(change.status))}>
                {change.status}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {getActionLabel(change.action)}
              </Badge>
              <span className="text-sm text-muted-foreground capitalize">
                {change.entity_type}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("detailTitle", { action: getActionLabel(change.action), type: change.entity_type })}
            </h1>
          </div>
        </div>

        {/* Action buttons (only for pending changes and if user can approve) */}
        {isPending && canApprove && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(true)}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {t("reject")}
            </Button>
            <Button onClick={() => setApproveDialogOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {t("approve")}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Request Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t("requestInfo.title")}</CardTitle>
            <CardDescription>{t("requestInfo.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-medium">{t("requestInfo.requester")}</div>
                <div className="text-sm text-muted-foreground">{change.requester_name}</div>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-medium">{t("requestInfo.created")}</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(change.created_at).toLocaleString()}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-medium">{t("requestInfo.entityId")}</div>
                <div className="text-sm text-muted-foreground font-mono">
                  {change.entity_id || t("requestInfo.newEntity")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Information (if reviewed) */}
        {change.status !== "pending" && (
          <Card>
            <CardHeader>
              <CardTitle>{t("reviewInfo.title")}</CardTitle>
              <CardDescription>{t("reviewInfo.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium">{t("reviewInfo.reviewer")}</div>
                  <div className="text-sm text-muted-foreground">
                    {change.reviewer_name || t("reviewInfo.unknown")}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium">{t("reviewInfo.reviewedAt")}</div>
                  <div className="text-sm text-muted-foreground">
                    {change.reviewed_at ? new Date(change.reviewed_at).toLocaleString() : t("reviewInfo.unknown")}
                  </div>
                </div>
              </div>

              {change.status === "rejected" && change.rejection_reason && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{t("reviewInfo.reason")}</div>
                      <div className="text-sm text-destructive">{change.rejection_reason}</div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payload */}
      <Card>
        <CardHeader>
          <CardTitle>{t("payload.title")}</CardTitle>
          <CardDescription>{t("payload.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PayloadDiff payload={change.payload} action={change.action} />
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("approveDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("approveDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("approveDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isApproving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isApproving ? t("approveDialog.approving") : t("approveDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("rejectDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">{t("rejectDialog.reason")}</Label>
              <Textarea
                id="reason"
                placeholder={t("rejectDialog.reasonPlaceholder")}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t("rejectDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !rejectionReason.trim()}
            >
              {isRejecting ? t("rejectDialog.rejecting") : t("rejectDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
