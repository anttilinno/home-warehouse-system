"use client";

import * as React from "react";
import { useState } from "react";
import { Check, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PhotoCaptionEditorProps {
  photoId: string;
  currentCaption: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (photoId: string, caption: string) => Promise<void>;
}

const MAX_CAPTION_LENGTH = 200;

export function PhotoCaptionEditor({
  photoId,
  currentCaption,
  open,
  onOpenChange,
  onSave,
}: PhotoCaptionEditorProps) {
  const t = useTranslations("photos.captionEditor");
  const [caption, setCaption] = useState(currentCaption || "");
  const [isSaving, setIsSaving] = useState(false);

  // Update caption when currentCaption changes
  React.useEffect(() => {
    setCaption(currentCaption || "");
  }, [currentCaption]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(photoId, caption);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCaption(currentCaption || "");
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const remainingChars = MAX_CAPTION_LENGTH - caption.length;
  const isOverLimit = remainingChars < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="caption">{t("caption")}</Label>
            <Input
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              maxLength={MAX_CAPTION_LENGTH + 50} // Allow typing a bit over for better UX
              className={isOverLimit ? "border-destructive" : ""}
              autoFocus
            />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("hint")}</span>
              <span
                className={
                  isOverLimit
                    ? "text-destructive font-medium"
                    : remainingChars < 20
                    ? "text-yellow-600"
                    : "text-muted-foreground"
                }
              >
                {remainingChars} {t("charactersRemaining")}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="mr-2 h-4 w-4" />
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isOverLimit}
          >
            <Check className="mr-2 h-4 w-4" />
            {isSaving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Alternative inline editor component for quick editing
 * Can be used for inline editing without opening a dialog
 */
interface InlineCaptionEditorProps {
  currentCaption: string | null;
  onSave: (caption: string) => Promise<void>;
  onCancel: () => void;
}

export function InlineCaptionEditor({
  currentCaption,
  onSave,
  onCancel,
}: InlineCaptionEditorProps) {
  const t = useTranslations("photos.captionEditor");
  const [caption, setCaption] = useState(currentCaption || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(caption);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const remainingChars = MAX_CAPTION_LENGTH - caption.length;
  const isOverLimit = remainingChars < 0;

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 space-y-1">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          maxLength={MAX_CAPTION_LENGTH + 50}
          className={isOverLimit ? "border-destructive" : ""}
          autoFocus
          disabled={isSaving}
        />
        <div className="flex justify-end text-xs">
          <span
            className={
              isOverLimit
                ? "text-destructive font-medium"
                : remainingChars < 20
                ? "text-yellow-600"
                : "text-muted-foreground"
            }
          >
            {remainingChars}
          </span>
        </div>
      </div>
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving || isOverLimit}
          className="h-9 w-9"
        >
          <Check className="h-4 w-4" />
          <span className="sr-only">{t("save")}</span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onCancel}
          disabled={isSaving}
          className="h-9 w-9"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t("cancel")}</span>
        </Button>
      </div>
    </div>
  );
}
