"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { useItemPhotos } from "@/lib/hooks/use-item-photos";
import { Button } from "@/components/ui/button";

interface CompactPhotoGridProps {
  workspaceId: string;
  itemId: string;
  refreshRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Compact photo grid for use inside dialogs.
 * Shows small thumbnails with delete buttons — no reordering, selection, or viewer.
 */
export function CompactPhotoGrid({
  workspaceId,
  itemId,
  refreshRef,
}: CompactPhotoGridProps) {
  const t = useTranslations("photos");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    photos,
    loading,
    deletePhoto,
    refresh,
  } = useItemPhotos({ workspaceId, itemId });

  useEffect(() => {
    if (refreshRef) {
      refreshRef.current = refresh;
      return () => { refreshRef.current = null; };
    }
  }, [refreshRef, refresh]);

  const handleDelete = async (photoId: string) => {
    setDeletingId(photoId);
    try {
      await deletePhoto(photoId);
      toast.success(t("gallery.deleteSuccess"));
    } catch {
      toast.error(t("gallery.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-2">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="relative group aspect-square rounded-md overflow-hidden border bg-muted"
        >
          <img
            src={photo.urls?.small || photo.urls?.original}
            alt={photo.caption || ""}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleDelete(photo.id)}
            disabled={deletingId === photo.id}
          >
            {deletingId === photo.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
          {photo.is_primary && (
            <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">
              Primary
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
