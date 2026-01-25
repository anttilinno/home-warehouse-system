"use client";

import * as React from "react";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DuplicateInfo } from "@/lib/types/item-photo";

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateInfo[];
  hasExact: boolean;
  onProceed: () => void;
  onCancel: () => void;
  isUploading?: boolean;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicates,
  hasExact,
  onProceed,
  onCancel,
  isUploading = false,
}: DuplicateWarningDialogProps) {
  const t = useTranslations("photos.duplicates");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {hasExact ? t("exactTitle") : t("similarTitle")}
          </DialogTitle>
          <DialogDescription>
            {hasExact ? t("exactDescription") : t("similarDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-3">
            {t("foundCount", { count: duplicates.length })}
          </p>
          <div className="flex gap-2 flex-wrap">
            {duplicates.slice(0, 4).map((dup) => (
              <div key={dup.photo_id} className="relative">
                {dup.thumbnail_url ? (
                  <Image
                    src={dup.thumbnail_url}
                    alt={t("existingPhoto")}
                    width={80}
                    height={80}
                    className="rounded border object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded border bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">No preview</span>
                  </div>
                )}
                <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                  {dup.similarity_percent}%
                </span>
              </div>
            ))}
            {duplicates.length > 4 && (
              <div className="w-20 h-20 rounded border bg-muted flex items-center justify-center">
                <span className="text-sm text-muted-foreground">
                  +{duplicates.length - 4}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isUploading}>
            {t("cancel")}
          </Button>
          <Button onClick={onProceed} disabled={isUploading}>
            {isUploading ? t("uploading") : t("uploadAnyway")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
