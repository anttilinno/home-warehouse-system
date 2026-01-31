"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { InlinePhotoCapture } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CapturedPhoto {
  file: File;
  preview: string;
}

interface PhotosStepProps {
  onBack: () => void;
  isSubmitting: boolean;
  onPhotosChange: (photos: File[]) => void;
  keyboardStyle?: React.CSSProperties;
  isKeyboardOpen?: boolean;
}

export function PhotosStep({
  onBack,
  isSubmitting,
  onPhotosChange,
  keyboardStyle,
  isKeyboardOpen,
}: PhotosStepProps) {
  const t = useTranslations("items.create");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  const handleCapture = useCallback(
    (file: File, preview: string) => {
      setPhotos((prev) => {
        const updated = [...prev, { file, preview }];
        onPhotosChange(updated.map((p) => p.file));
        return updated;
      });
    },
    [onPhotosChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      setPhotos((prev) => {
        // Revoke the blob URL before removing
        URL.revokeObjectURL(prev[index].preview);
        const updated = prev.filter((_, i) => i !== index);
        onPhotosChange(updated.map((p) => p.file));
        return updated;
      });
    },
    [onPhotosChange]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("steps.photos")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.photosDescription")}
        </p>
      </div>

      {/* Captured photos */}
      <div className="space-y-4">
        {photos.map((photo, index) => (
          <div key={photo.preview} className="relative">
            <InlinePhotoCapture
              label={`${t("fields.photo")} ${index + 1}`}
              preview={photo.preview}
              onCapture={() => {}}
              onRemove={() => handleRemove(index)}
            />
          </div>
        ))}

        {/* Add new photo */}
        {photos.length < 5 && (
          <InlinePhotoCapture
            label={
              photos.length === 0
                ? t("fields.addPhoto")
                : t("fields.addAnotherPhoto")
            }
            onCapture={(file) => {
              const preview = URL.createObjectURL(file);
              handleCapture(file, preview);
            }}
            onRemove={() => {}}
          />
        )}

        {photos.length >= 5 && (
          <p className="text-sm text-muted-foreground">
            {t("fields.maxPhotosReached")}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div
        className={cn(
          "flex justify-between pt-4 border-t",
          isKeyboardOpen &&
            "fixed left-0 right-0 bg-background px-4 pb-4 shadow-lg z-50"
        )}
        style={isKeyboardOpen ? keyboardStyle : undefined}
      >
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="min-h-[44px] min-w-[100px]"
        >
          {t("back")}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[44px] min-w-[120px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("creating")}
            </>
          ) : (
            t("createItem")
          )}
        </Button>
      </div>
    </div>
  );
}
