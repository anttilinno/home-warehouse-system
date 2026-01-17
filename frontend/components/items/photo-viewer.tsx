"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import type { ItemPhoto } from "@/lib/types/item-photo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PhotoViewerProps {
  photos: ItemPhoto[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoViewer({
  photos,
  initialIndex = 0,
  open,
  onOpenChange,
}: PhotoViewerProps) {
  const t = useTranslations("photos.viewer");
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const currentPhoto = photos[currentIndex];
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  // Reset zoom when photo changes
  useEffect(() => {
    setZoom(1);
  }, [currentIndex]);

  // Update current index when initial index changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    if (hasPrevious) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [hasPrevious]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [hasNext]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.5, 1));
  }, []);

  const handleDownload = useCallback(() => {
    if (currentPhoto) {
      window.open(currentPhoto.urls.original, "_blank");
    }
  }, [currentPhoto]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          handleClose();
          break;
        case "ArrowLeft":
          goToPrevious();
          break;
        case "ArrowRight":
          goToNext();
          break;
        case "+":
        case "=":
          e.preventDefault();
          handleZoomIn();
          break;
        case "-":
          e.preventDefault();
          handleZoomOut();
          break;
        case "0":
          e.preventDefault();
          setZoom(1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goToPrevious, goToNext, handleZoomIn, handleZoomOut, handleClose]);

  // Touch gesture handling for mobile swipe
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && hasNext) {
      goToNext();
    } else if (isRightSwipe && hasPrevious) {
      goToPrevious();
    }
  };

  if (!currentPhoto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-screen max-h-screen h-screen w-screen border-0 p-0 bg-black/95"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header with controls */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <Button
              size="icon"
              variant="ghost"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="text-white hover:bg-white/20"
            >
              <ZoomOut className="h-5 w-5" />
              <span className="sr-only">{t("zoomOut")}</span>
            </Button>
            <span className="text-sm text-white">{Math.round(zoom * 100)}%</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="text-white hover:bg-white/20"
            >
              <ZoomIn className="h-5 w-5" />
              <span className="sr-only">{t("zoomIn")}</span>
            </Button>

            {/* Download */}
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDownload}
              className="text-white hover:bg-white/20"
            >
              <Download className="h-5 w-5" />
              <span className="sr-only">{t("download")}</span>
            </Button>

            {/* Close */}
            <DialogClose asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">{t("close")}</span>
              </Button>
            </DialogClose>
          </div>
        </div>

        {/* Main image area */}
        <div
          className="flex h-full w-full items-center justify-center overflow-hidden p-16"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="relative transition-transform duration-200"
            style={{
              transform: `scale(${zoom})`,
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            <Image
              src={currentPhoto.urls.large}
              alt={currentPhoto.caption || `Photo ${currentIndex + 1}`}
              width={currentPhoto.width}
              height={currentPhoto.height}
              className="max-h-[calc(100vh-8rem)] max-w-full object-contain"
              priority
            />
          </div>
        </div>

        {/* Navigation arrows */}
        {hasPrevious && (
          <Button
            size="icon"
            variant="ghost"
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <ChevronLeft className="h-8 w-8" />
            <span className="sr-only">{t("previous")}</span>
          </Button>
        )}

        {hasNext && (
          <Button
            size="icon"
            variant="ghost"
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <ChevronRight className="h-8 w-8" />
            <span className="sr-only">{t("next")}</span>
          </Button>
        )}

        {/* Caption overlay */}
        {currentPhoto.caption && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <p className="text-center text-white">{currentPhoto.caption}</p>
          </div>
        )}

        {/* Keyboard hints */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full bg-black/50 px-4 py-2 text-xs text-white/70">
          <span>← →: {t("navigate")}</span>
          <span>±: {t("zoom")}</span>
          <span>ESC: {t("close")}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
