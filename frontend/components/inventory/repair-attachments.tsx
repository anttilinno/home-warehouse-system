"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Paperclip,
  FileText,
  Receipt,
  FileImage,
  Shield,
  File,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";

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
} from "@/components/ui/alert-dialog";

import { repairLogsApi } from "@/lib/api";
import type { RepairAttachment, AttachmentType } from "@/lib/types/repair-log";

const ATTACHMENT_TYPE_CONFIG: Record<AttachmentType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  PHOTO: { label: "Photo", icon: FileImage, color: "bg-blue-500" },
  MANUAL: { label: "Manual", icon: FileText, color: "bg-gray-500" },
  RECEIPT: { label: "Receipt", icon: Receipt, color: "bg-green-500" },
  WARRANTY: { label: "Warranty", icon: Shield, color: "bg-purple-500" },
  OTHER: { label: "Other", icon: File, color: "bg-orange-500" },
};

interface RepairAttachmentsProps {
  workspaceId: string;
  repairLogId: string;
  attachments: RepairAttachment[];
  onAttachmentsChange: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function RepairAttachments({
  workspaceId,
  repairLogId,
  attachments,
  onAttachmentsChange,
}: RepairAttachmentsProps) {
  const t = useTranslations("repairs");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<RepairAttachment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAttachment = async () => {
    if (!attachmentToDelete) return;

    try {
      setIsDeleting(true);
      await repairLogsApi.unlinkAttachment(workspaceId, repairLogId, attachmentToDelete.id);
      toast.success(t("deleteSuccess"));
      onAttachmentsChange();
      setDeleteDialogOpen(false);
      setAttachmentToDelete(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to unlink attachment";
      toast.error(t("error"), { description: errorMessage });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = useCallback((attachment: RepairAttachment) => {
    setAttachmentToDelete(attachment);
    setDeleteDialogOpen(true);
  }, []);

  if (attachments.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{t("noAttachments")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        const config = ATTACHMENT_TYPE_CONFIG[attachment.attachment_type];
        const Icon = config.icon;

        return (
          <div
            key={attachment.id}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card"
          >
            <div className={`p-2 rounded ${config.color}`}>
              <Icon className="h-4 w-4 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {attachment.title || attachment.file.original_name}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>
                <span>{formatFileSize(attachment.file.size_bytes)}</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => openDeleteDialog(attachment)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink this attachment from the repair? The file will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAttachment}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unlinking...
                </>
              ) : (
                "Unlink"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
