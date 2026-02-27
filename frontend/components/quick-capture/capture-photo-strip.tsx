"use client";

import { X, Camera } from "lucide-react";
import { useTranslations } from "next-intl";

interface CapturedPhoto {
  id: string;
  preview: string; // Object URL
}

interface CapturePhotoStripProps {
  photos: CapturedPhoto[];
  maxPhotos?: number;
  onTakePhoto: () => void;
  onRemovePhoto: (id: string) => void;
}

export function CapturePhotoStrip({
  photos,
  maxPhotos = 5,
  onTakePhoto,
  onRemovePhoto,
}: CapturePhotoStripProps) {
  const t = useTranslations("quickCapture");

  // Empty state: full-width take-photo button
  if (photos.length === 0) {
    return (
      <button
        type="button"
        onClick={onTakePhoto}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 py-3 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        style={{ minHeight: 48 }}
      >
        <Camera className="h-5 w-5" />
        <span className="text-sm font-medium">{t("takePhoto")}</span>
      </button>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto py-1">
      {photos.map((photo) => (
        <div key={photo.id} className="relative flex-shrink-0">
          <img
            src={photo.preview}
            alt=""
            className="h-16 w-16 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={() => onRemovePhoto(photo.id)}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
            style={{ minWidth: 20, minHeight: 20 }}
            aria-label={t("removePhoto")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {photos.length < maxPhotos && (
        <button
          type="button"
          onClick={onTakePhoto}
          className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <Camera className="h-4 w-4" />
          <span className="text-[10px] leading-tight">
            {t("photosCount", { count: photos.length })}
          </span>
        </button>
      )}
    </div>
  );
}

export type { CapturedPhoto, CapturePhotoStripProps };
