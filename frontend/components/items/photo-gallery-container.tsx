"use client";

/**
 * PhotoGalleryContainer
 *
 * Example integration component that demonstrates how to use PhotoGallery,
 * PhotoViewer, and PhotoCaptionEditor together with the API hooks.
 *
 * This component can be used as a reference or directly integrated into item detail pages.
 */

import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { CheckSquare, X } from "lucide-react";

import type { ItemPhoto } from "@/lib/types/item-photo";
import { useItemPhotos } from "@/lib/hooks/use-item-photos";
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { itemPhotosApi } from "@/lib/api/item-photos";
import { Button } from "@/components/ui/button";
import { PhotoGallery } from "./photo-gallery";
import { PhotoViewer } from "./photo-viewer";
import { PhotoCaptionEditor } from "./photo-caption-editor";
import { PhotoSelectionBar } from "./photo-selection-bar";

interface PhotoGalleryContainerProps {
  workspaceId: string;
  itemId: string;
  onUploadClick?: () => void;
}

/**
 * Full-featured photo gallery container with all functionality integrated
 */
export function PhotoGalleryContainer({
  workspaceId,
  itemId,
  onUploadClick,
}: PhotoGalleryContainerProps) {
  const t = useTranslations("photos");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [captionEditorOpen, setCaptionEditorOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<{
    id: string;
    caption: string | null;
  } | null>(null);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    selectedIds,
    selectedCount,
    toggleSelection,
    selectAll,
    clearSelection,
  } = useBulkSelection<string>();

  const {
    photos,
    loading: isLoading,
    reorder: reorderPhotos,
    setPrimary: setPrimaryPhoto,
    updateCaption,
    deletePhoto,
    refresh: refreshPhotos,
  } = useItemPhotos({ workspaceId, itemId });

  // Handle photo click to open viewer
  const handlePhotoClick = (photo: ItemPhoto, index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  // Handle reordering photos
  const handleReorder = async (photoIds: string[]) => {
    try {
      await reorderPhotos(photoIds);
      toast.success(t("gallery.reorderSuccess"));
    } catch (error) {
      toast.error(t("gallery.reorderError"));
      throw error; // Re-throw to trigger revert in gallery
    }
  };

  // Handle setting primary photo
  const handleSetPrimary = async (photoId: string) => {
    try {
      await setPrimaryPhoto(photoId);
      toast.success(t("gallery.setPrimarySuccess"));
    } catch (error) {
      toast.error(t("gallery.setPrimaryError"));
    }
  };

  // Handle opening caption editor
  const handleEditCaption = (photoId: string, currentCaption: string | null) => {
    setEditingPhoto({ id: photoId, caption: currentCaption });
    setCaptionEditorOpen(true);
  };

  // Handle saving caption
  const handleSaveCaption = async (photoId: string, caption: string) => {
    try {
      await updateCaption(photoId, caption);
      toast.success(t("captionEditor.saveSuccess"));
    } catch (error) {
      toast.error(t("captionEditor.saveError"));
      throw error; // Re-throw to keep dialog open on error
    }
  };

  // Handle deleting photo
  const handleDelete = async (photoId: string) => {
    try {
      await deletePhoto(photoId);
      toast.success(t("gallery.deleteSuccess"));
    } catch (error) {
      toast.error(t("gallery.deleteError"));
    }
  };

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      clearSelection();
    }
    setSelectionMode(!selectionMode);
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    setIsDeleting(true);
    try {
      await itemPhotosApi.bulkDelete(
        workspaceId,
        itemId,
        Array.from(selectedIds)
      );
      toast.success(t("bulk.deleteSuccess", { count: selectedCount }));
      clearSelection();
      setSelectionMode(false);
      await refreshPhotos();
    } catch (error) {
      toast.error(t("bulk.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle bulk caption update
  const handleBulkCaption = async (caption: string) => {
    if (selectedCount === 0) return;
    setIsUpdating(true);
    try {
      const updates = Array.from(selectedIds).map((photo_id) => ({
        photo_id,
        caption: caption || null,
      }));
      await itemPhotosApi.bulkUpdateCaptions(workspaceId, itemId, updates);
      toast.success(t("bulk.captionSuccess", { count: selectedCount }));
      clearSelection();
      setSelectionMode(false);
      await refreshPhotos();
    } catch (error) {
      toast.error(t("bulk.captionError"));
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle download
  const handleDownload = async () => {
    try {
      const photoIds = selectedCount > 0 ? Array.from(selectedIds) : undefined;
      await itemPhotosApi.downloadAsZip(workspaceId, itemId, photoIds);
      toast.success(t("bulk.downloadSuccess"));
    } catch (error) {
      toast.error(t("bulk.downloadError"));
    }
  };

  return (
    <>
      {/* Selection mode toggle button */}
      {photos.length > 0 && (
        <div className="flex items-center justify-end mb-4 gap-2">
          <Button
            variant={selectionMode ? "secondary" : "outline"}
            size="sm"
            onClick={handleToggleSelectionMode}
          >
            {selectionMode ? (
              <>
                <X className="mr-2 h-4 w-4" />
                {t("bulk.cancel")}
              </>
            ) : (
              <>
                <CheckSquare className="mr-2 h-4 w-4" />
                {t("bulk.select")}
              </>
            )}
          </Button>
        </div>
      )}

      <PhotoGallery
        itemId={itemId}
        photos={photos}
        isLoading={isLoading}
        onPhotoClick={handlePhotoClick}
        onReorder={handleReorder}
        onSetPrimary={handleSetPrimary}
        onEditCaption={handleEditCaption}
        onDelete={handleDelete}
        onUploadClick={onUploadClick}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelection}
        onSelectAll={selectAll}
      />

      {/* Bulk action bar */}
      <PhotoSelectionBar
        selectedCount={selectedCount}
        onClear={clearSelection}
        onBulkDelete={handleBulkDelete}
        onBulkCaption={handleBulkCaption}
        onDownload={handleDownload}
        isDeleting={isDeleting}
        isUpdating={isUpdating}
      />

      <PhotoViewer
        photos={photos}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      {editingPhoto && (
        <PhotoCaptionEditor
          photoId={editingPhoto.id}
          currentCaption={editingPhoto.caption}
          open={captionEditorOpen}
          onOpenChange={setCaptionEditorOpen}
          onSave={handleSaveCaption}
        />
      )}
    </>
  );
}
