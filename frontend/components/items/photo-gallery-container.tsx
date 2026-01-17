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

import type { ItemPhoto } from "@/lib/types/item-photo";
import { useItemPhotos } from "@/lib/hooks/use-item-photos";
import { PhotoGallery } from "./photo-gallery";
import { PhotoViewer } from "./photo-viewer";
import { PhotoCaptionEditor } from "./photo-caption-editor";

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

  const {
    photos,
    loading: isLoading,
    reorder: reorderPhotos,
    setPrimary: setPrimaryPhoto,
    updateCaption,
    deletePhoto,
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

  return (
    <>
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
