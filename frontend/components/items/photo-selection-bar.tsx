"use client";

import * as React from "react";
import { Trash2, Edit3, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface PhotoSelectionBarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkDelete: () => Promise<void>;
  onBulkCaption: (caption: string) => Promise<void>;
  onDownload: () => void;
  isDeleting?: boolean;
  isUpdating?: boolean;
}

export function PhotoSelectionBar({
  selectedCount,
  onClear,
  onBulkDelete,
  onBulkCaption,
  onDownload,
  isDeleting = false,
  isUpdating = false,
}: PhotoSelectionBarProps) {
  const t = useTranslations("photos.bulk");
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showCaptionDialog, setShowCaptionDialog] = React.useState(false);
  const [caption, setCaption] = React.useState("");

  const handleDelete = async () => {
    await onBulkDelete();
    setShowDeleteDialog(false);
  };

  const handleCaption = async () => {
    await onBulkCaption(caption);
    setShowCaptionDialog(false);
    setCaption("");
  };

  return (
    <>
      <BulkActionBar selectedCount={selectedCount} onClear={onClear}>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
        >
          <Download className="mr-2 h-4 w-4" />
          {t("download")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCaptionDialog(true)}
          disabled={isUpdating}
        >
          <Edit3 className="mr-2 h-4 w-4" />
          {t("editCaptions")}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isDeleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("delete")}
        </Button>
      </BulkActionBar>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { count: selectedCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("deleting") : t("confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Caption edit dialog */}
      <Dialog open={showCaptionDialog} onOpenChange={setShowCaptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("captionTitle")}</DialogTitle>
            <DialogDescription>
              {t("captionDescription", { count: selectedCount })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="caption">{t("captionLabel")}</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("captionPlaceholder")}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCaptionDialog(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCaption} disabled={isUpdating}>
              {isUpdating ? t("updating") : t("applyCaption")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
