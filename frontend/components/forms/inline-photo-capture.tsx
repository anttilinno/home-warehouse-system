"use client";

import { useState, useCallback, useRef } from "react";
import { Camera, ImagePlus, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  createImagePreview,
  revokeImagePreview,
  compressImage,
  validateImageFile,
} from "@/lib/utils/image";
import { cn } from "@/lib/utils";

interface CapturedPhoto {
  file: File;
  preview: string;
}

interface InlinePhotoCaptureProps {
  /** Field label */
  label?: string;
  /** Called when a photo is captured/selected */
  onCapture: (file: File) => void;
  /** Called when photo is removed */
  onRemove: () => void;
  /** Current preview URL (for controlled mode) */
  preview?: string | null;
  /** Whether field is required */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional classes */
  className?: string;
  /** Compression threshold in bytes (default: 2MB) */
  compressionThreshold?: number;
  /** Error message to display */
  error?: string;
}

const DEFAULT_COMPRESSION_THRESHOLD = 2 * 1024 * 1024; // 2MB

export function InlinePhotoCapture({
  label,
  onCapture,
  onRemove,
  preview,
  required,
  disabled,
  className,
  compressionThreshold = DEFAULT_COMPRESSION_THRESHOLD,
  error,
}: InlinePhotoCaptureProps) {
  const t = useTranslations("forms.photoCapture");
  const [isProcessing, setIsProcessing] = useState(false);
  const [localPreview, setLocalPreview] = useState<CapturedPhoto | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Use prop preview or local preview
  const displayPreview = preview || localPreview?.preview;

  // Handle file selection/capture
  const handleFile = useCallback(
    async (file: File) => {
      // Validate file using existing utility (validates type and size)
      const validation = validateImageFile(file);
      if (!validation.valid) {
        console.error("[InlinePhotoCapture] Validation failed:", validation.error);
        return;
      }

      setIsProcessing(true);

      try {
        let processedFile = file;

        // Compress if needed
        if (file.size > compressionThreshold) {
          processedFile = await compressImage(file, 1920, 1920, 0.85);
        }

        // Create preview
        const previewUrl = createImagePreview(processedFile);

        // Cleanup old local preview
        if (localPreview?.preview) {
          revokeImagePreview(localPreview.preview);
        }

        setLocalPreview({ file: processedFile, preview: previewUrl });
        onCapture(processedFile);
      } catch (err) {
        console.error("[InlinePhotoCapture] Processing error:", err);
      } finally {
        setIsProcessing(false);
      }
    },
    [compressionThreshold, localPreview, onCapture]
  );

  // Handle camera capture
  const handleCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }
    },
    [handleFile]
  );

  // Handle gallery selection
  const handleGalleryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input
      if (galleryInputRef.current) {
        galleryInputRef.current.value = "";
      }
    },
    [handleFile]
  );

  // Handle remove
  const handleRemove = useCallback(() => {
    if (localPreview?.preview) {
      revokeImagePreview(localPreview.preview);
    }
    setLocalPreview(null);
    onRemove();
  }, [localPreview, onRemove]);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      {label && (
        <Label className="text-base font-medium">
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}

      {/* Photo preview or capture buttons */}
      {displayPreview ? (
        // Preview mode
        <div className="relative inline-block">
          <div className="relative aspect-square w-32 rounded-lg overflow-hidden border bg-muted">
            <img
              src={displayPreview}
              alt={t("previewAlt")}
              className="w-full h-full object-cover"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
              onClick={handleRemove}
              aria-label={t("remove")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        // Capture mode
        <div className="flex flex-wrap gap-2">
          {/* Camera button - uses capture="environment" for mobile rear camera */}
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] min-w-[44px] touch-manipulation"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {t("takePhoto")}
          </Button>

          {/* Gallery button */}
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] min-w-[44px] touch-manipulation"
            onClick={() => galleryInputRef.current?.click()}
            disabled={disabled || isProcessing}
          >
            <ImagePlus className="h-4 w-4 mr-2" />
            {t("chooseFile")}
          </Button>

          {/* Hidden camera input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraChange}
            className="sr-only"
            aria-label={t("cameraInput")}
          />

          {/* Hidden gallery input */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleGalleryChange}
            className="sr-only"
            aria-label={t("galleryInput")}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
