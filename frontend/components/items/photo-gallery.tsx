"use client";

import * as React from "react";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MoreVertical,
  Star,
  Edit3,
  Download,
  Trash2,
  GripVertical,
  Image as ImageIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ItemPhoto } from "@/lib/types/item-photo";
import { LazyPhoto } from "./lazy-photo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  itemId: string;
  photos: ItemPhoto[];
  isLoading?: boolean;
  onPhotoClick?: (photo: ItemPhoto, index: number) => void;
  onReorder?: (photoIds: string[]) => Promise<void>;
  onSetPrimary?: (photoId: string) => Promise<void>;
  onEditCaption?: (photoId: string, currentCaption: string | null) => void;
  onDelete?: (photoId: string) => Promise<void>;
  onUploadClick?: () => void;
}

interface SortablePhotoItemProps {
  photo: ItemPhoto;
  index: number;
  isPrimary: boolean;
  onPhotoClick: () => void;
  onSetPrimary: () => void;
  onEditCaption: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

function SortablePhotoItem({
  photo,
  index,
  isPrimary,
  onPhotoClick,
  onSetPrimary,
  onEditCaption,
  onDownload,
  onDelete,
}: SortablePhotoItemProps) {
  const t = useTranslations("photos.gallery");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-muted",
        isDragging && "opacity-50 z-50"
      )}
    >
      {/* Photo Image with lazy loading */}
      <div
        className="relative h-full w-full cursor-pointer"
        onClick={onPhotoClick}
      >
        <LazyPhoto
          src={photo.urls.medium}
          thumbnailSrc={photo.urls.small}
          alt={photo.caption || `Photo ${index + 1}`}
          fill
          className="transition-transform group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          priority={index < 4}
        />
      </div>

      {/* Overlay with actions (visible on hover) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 transition-opacity group-hover:opacity-100">
        {/* Top badges */}
        <div className="absolute top-2 left-2 flex gap-2">
          {isPrimary && (
            <Badge variant="secondary" className="bg-yellow-500/90 text-white">
              <Star className="mr-1 h-3 w-3 fill-white" />
              {t("primary")}
            </Badge>
          )}
          <Badge variant="secondary" className="bg-black/50 text-white">
            #{index + 1}
          </Badge>
        </div>

        {/* Drag handle */}
        <button
          className="absolute top-2 right-10 cursor-grab rounded-md bg-black/50 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Actions menu */}
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 bg-black/50 text-white hover:bg-black/70 hover:text-white"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">{t("actions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isPrimary && (
                <>
                  <DropdownMenuItem onClick={onSetPrimary}>
                    <Star className="mr-2 h-4 w-4" />
                    {t("setPrimary")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onEditCaption}>
                <Edit3 className="mr-2 h-4 w-4" />
                {t("editCaption")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownload}>
                <Download className="mr-2 h-4 w-4" />
                {t("download")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Caption (if exists) */}
        {photo.caption && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-sm text-white line-clamp-2">{photo.caption}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PhotoGallery({
  itemId,
  photos,
  isLoading = false,
  onPhotoClick,
  onReorder,
  onSetPrimary,
  onEditCaption,
  onDelete,
  onUploadClick,
}: PhotoGalleryProps) {
  const t = useTranslations("photos.gallery");
  const [sortedPhotos, setSortedPhotos] = useState<ItemPhoto[]>(photos);
  const [isReordering, setIsReordering] = useState(false);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update local state when photos prop changes
  React.useEffect(() => {
    setSortedPhotos(photos);
  }, [photos]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedPhotos.findIndex((p) => p.id === active.id);
      const newIndex = sortedPhotos.findIndex((p) => p.id === over.id);

      const newOrder = arrayMove(sortedPhotos, oldIndex, newIndex);
      setSortedPhotos(newOrder);

      // Optimistic update
      if (onReorder) {
        setIsReordering(true);
        try {
          await onReorder(newOrder.map((p) => p.id));
        } catch (error) {
          // Revert on error
          setSortedPhotos(photos);
        } finally {
          setIsReordering(false);
        }
      }
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    if (onSetPrimary) {
      await onSetPrimary(photoId);
    }
  };

  const handleEditCaption = (photoId: string, currentCaption: string | null) => {
    if (onEditCaption) {
      onEditCaption(photoId, currentCaption);
    }
  };

  const handleDownload = (photo: ItemPhoto) => {
    // Download the original image
    window.open(photo.urls.original, "_blank");
  };

  const handleDeleteConfirm = async () => {
    if (!deletePhotoId || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(deletePhotoId);
      setDeletePhotoId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  // Empty state
  if (sortedPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t("empty")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("emptyDescription")}
        </p>
        {onUploadClick && (
          <Button onClick={onUploadClick} className="mt-4">
            {t("uploadPhotos")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedPhotos.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedPhotos.map((photo, index) => (
              <SortablePhotoItem
                key={photo.id}
                photo={photo}
                index={index}
                isPrimary={photo.is_primary}
                onPhotoClick={() => onPhotoClick?.(photo, index)}
                onSetPrimary={() => handleSetPrimary(photo.id)}
                onEditCaption={() =>
                  handleEditCaption(photo.id, photo.caption)
                }
                onDownload={() => handleDownload(photo)}
                onDelete={() => setDeletePhotoId(photo.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deletePhotoId !== null}
        onOpenChange={(open) => !open && setDeletePhotoId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
