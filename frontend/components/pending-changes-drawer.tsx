"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getMutationQueue,
  removeMutation,
  updateMutationStatus,
} from "@/lib/sync/mutation-queue";
import { syncManager } from "@/lib/sync/sync-manager";
import type { MutationQueueEntry } from "@/lib/db/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  MapPin,
  Boxes,
  FolderTree,
  Users,
  Receipt,
} from "lucide-react";

interface PendingChangesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const entityIcons: Record<string, React.ElementType> = {
  items: Package,
  inventory: Boxes,
  locations: MapPin,
  containers: Boxes,
  categories: FolderTree,
  borrowers: Users,
  loans: Receipt,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  syncing: "bg-blue-500",
  failed: "bg-red-500",
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPayloadPreview(payload: Record<string, unknown>): string {
  // Try to extract a meaningful preview
  const name = payload.name || payload.title || payload.sku || "";
  if (typeof name === "string" && name.length > 0) {
    return name.length > 30 ? name.substring(0, 30) + "..." : name;
  }
  return "...";
}

export function PendingChangesDrawer({ open, onOpenChange }: PendingChangesDrawerProps) {
  const [mutations, setMutations] = useState<MutationQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);

  const loadMutations = useCallback(async () => {
    setLoading(true);
    try {
      const queue = await getMutationQueue();
      setMutations(queue.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error("Failed to load mutation queue:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadMutations();
    }
  }, [open, loadMutations]);

  const handleCancel = async (id: number) => {
    setActionInProgress(id);
    try {
      await removeMutation(id);
      await loadMutations();
    } catch (error) {
      console.error("Failed to cancel mutation:", error);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRetry = async (id: number) => {
    setActionInProgress(id);
    try {
      await updateMutationStatus(id, { status: "pending", retries: 0 });
      if (syncManager && navigator.onLine) {
        await syncManager.processQueue();
      }
      await loadMutations();
    } catch (error) {
      console.error("Failed to retry mutation:", error);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleClearAll = async () => {
    setLoading(true);
    try {
      for (const mutation of mutations) {
        await removeMutation(mutation.id);
      }
      setMutations([]);
    } catch (error) {
      console.error("Failed to clear mutations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (syncManager) {
      await syncManager.processQueue();
      await loadMutations();
    }
  };

  const pendingCount = mutations.filter((m) => m.status === "pending").length;
  const failedCount = mutations.filter((m) => m.status === "failed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Changes
          </DialogTitle>
          <DialogDescription>
            {mutations.length === 0
              ? "All changes have been synced."
              : `${pendingCount} pending, ${failedCount} failed`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mutations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">
              All changes have been synced to the server.
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
                disabled={!navigator.onLine || pendingCount === 0}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Sync Now
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all pending changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove {mutations.length} pending{" "}
                      {mutations.length === 1 ? "change" : "changes"}. This action cannot
                      be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll}>
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              <div className="space-y-3">
                {mutations.map((mutation) => {
                  const EntityIcon = entityIcons[mutation.entity] || Package;
                  const isProcessing = actionInProgress === mutation.id;

                  return (
                    <div
                      key={mutation.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <EntityIcon className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium capitalize">
                            {mutation.operation} {mutation.entity.slice(0, -1)}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] text-white ${statusColors[mutation.status]}`}
                          >
                            {mutation.status}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground truncate">
                          {formatPayloadPreview(mutation.payload)}
                        </p>

                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(mutation.timestamp)}
                          {mutation.retries > 0 && ` · ${mutation.retries} retries`}
                        </p>

                        {mutation.lastError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {mutation.lastError.length > 50
                              ? mutation.lastError.substring(0, 50) + "..."
                              : mutation.lastError}
                          </p>
                        )}
                      </div>

                      <div className="flex-shrink-0 flex gap-1">
                        {mutation.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRetry(mutation.id)}
                            disabled={isProcessing}
                            title="Retry"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleCancel(mutation.id)}
                          disabled={isProcessing}
                          title="Cancel"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
