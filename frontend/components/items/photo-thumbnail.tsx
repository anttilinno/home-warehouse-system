"use client";

import * as React from "react";
import { useState } from "react";
import Image from "next/image";
import { Loader2, AlertCircle, ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ItemPhoto } from "@/lib/types/item-photo";
import { isThumbnailProcessing, getBestThumbnailUrl } from "@/lib/types/item-photo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PhotoThumbnailProps {
  photo: ItemPhoto;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  sm: { width: 64, height: 64 },
  md: { width: 128, height: 128 },
  lg: { width: 256, height: 256 },
};

/**
 * PhotoThumbnail component displays a photo thumbnail with processing/error states.
 *
 * States:
 * - pending/processing: Shows a spinner with "Processing" label
 * - failed: Shows an error icon with the error message in tooltip
 * - complete: Shows the thumbnail image
 */
export function PhotoThumbnail({
  photo,
  size = "md",
  className,
  onClick,
}: PhotoThumbnailProps) {
  const t = useTranslations("photos.thumbnail");
  const [imageError, setImageError] = useState(false);
  const dimensions = sizeMap[size];

  // Get thumbnail URL based on status
  const thumbnailUrl = getBestThumbnailUrl(photo);

  // Render processing state (pending or processing)
  if (isThumbnailProcessing(photo)) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-md",
          className
        )}
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">{t("processing")}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("generatingThumbnails")}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Render failed state
  if (photo.thumbnail_status === "failed") {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-destructive/10 rounded-md",
          className
        )}
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-1 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <span className="text-xs">{t("failed")}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{photo.thumbnail_error || t("defaultError")}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Render complete state - show image or fallback
  if (!thumbnailUrl || imageError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-md",
          className
        )}
        style={{ width: dimensions.width, height: dimensions.height }}
        onClick={onClick}
      >
        <ImageOff className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-md overflow-hidden cursor-pointer",
        className
      )}
      style={{ width: dimensions.width, height: dimensions.height }}
      onClick={onClick}
    >
      <Image
        src={thumbnailUrl}
        alt={photo.caption || "Photo"}
        fill
        className="object-cover"
        onError={() => setImageError(true)}
        sizes={`${dimensions.width}px`}
      />
    </div>
  );
}
