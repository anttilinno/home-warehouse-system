"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ImagePlus,
  Camera,
  Wrench,
  CheckCircle,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { validateImageFile, createImagePreview, revokeImagePreview, formatFileSize, compressImage } from "@/lib/utils/image";
import { repairLogsApi } from "@/lib/api";
import type { RepairPhoto, RepairPhotoType } from "@/lib/types/repair-log";

const PHOTO_TYPE_CONFIG: Record<RepairPhotoType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  BEFORE: { label: "Before", icon: Camera, color: "bg-orange-500" },
  DURING: { label: "During", icon: Wrench, color: "bg-blue-500" },
  AFTER: { label: "After", icon: CheckCircle, color: "bg-green-500" },
};

interface RepairPhotoUploadProps {
  workspaceId: string;
  repairLogId: string;
  photos: RepairPhoto[];
  onPhotosChange: () => void;
}

interface PreviewFile {
  file: File;
  preview: string;
  photoType: RepairPhotoType;
  caption: string;
  uploading: boolean;
  compressing: boolean;
  progress: number;
  uploaded: boolean;
  error: string | null;
  photo?: RepairPhoto;
}

const DEFAULT_COMPRESSION_THRESHOLD = 2 * 1024 * 1024; // 2MB

export function RepairPhotoUpload({
  workspaceId,
  repairLogId,
  photos,
  onPhotosChange,
}: RepairPhotoUploadProps) {
  const t = useTranslations("repairs");
  const tPhotos = useTranslations("photos.upload");

  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhotoType, setSelectedPhotoType] = useState<RepairPhotoType>("DURING");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<RepairPhoto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Group photos by type
  const photosByType = useMemo(() => {
    const grouped: Record<RepairPhotoType, RepairPhoto[]> = {
      BEFORE: [],
      DURING: [],
      AFTER: [],
    };
    photos.forEach((photo) => {
      const type = photo.photo_type as RepairPhotoType;
      if (grouped[type]) {
        grouped[type].push(photo);
      }
    });
    return grouped;
  }, [photos]);

  // Calculate upload stats
  const overallProgress = useMemo(() => {
    if (files.length === 0) return 0;
    const pendingFiles = files.filter((f) => !f.uploaded);
    if (pendingFiles.length === 0) return 100;
    const totalProgress = files.reduce((sum, f) => sum + f.progress, 0);
    return Math.round(totalProgress / files.length);
  }, [files]);

  const uploadingCount = files.filter((f) => f.uploading).length;
  const compressingCount = files.filter((f) => f.compressing).length;
  const isProcessing = isUploading || compressingCount > 0 || uploadingCount > 0;

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => revokeImagePreview(f.preview));
    };
  }, [files]);

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: PreviewFile[] = [];
    const maxFiles = 10;

    for (const file of newFiles) {
      if (files.length + validFiles.length >= maxFiles) {
        toast.error(tPhotos("tooManyFiles", { max: maxFiles }));
        break;
      }

      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast.error(tPhotos("invalidFile"), { description: validation.error });
        continue;
      }

      const isDuplicate = files.some((f) =>
        f.file.name === file.name && f.file.size === file.size
      );
      if (isDuplicate) {
        toast.error(tPhotos("duplicateFile"), { description: file.name });
        continue;
      }

      validFiles.push({
        file,
        preview: createImagePreview(file),
        photoType: selectedPhotoType,
        caption: "",
        uploading: false,
        compressing: false,
        progress: 0,
        uploaded: false,
        error: null,
      });
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }
  }, [files, selectedPhotoType, tPhotos]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const file = prev[index];
      if (file) {
        revokeImagePreview(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateCaption = useCallback((index: number, caption: string) => {
    setFiles((prev) =>
      prev.map((f, i) => i === index ? { ...f, caption } : f)
    );
  }, []);

  const updatePhotoType = useCallback((index: number, photoType: RepairPhotoType) => {
    setFiles((prev) =>
      prev.map((f, i) => i === index ? { ...f, photoType } : f)
    );
  }, []);

  const uploadFile = async (index: number) => {
    const file = files[index];
    if (!file || file.uploaded || file.uploading || file.compressing) return;

    let fileToUpload = file.file;

    // Compress large files first
    if (file.file.size > DEFAULT_COMPRESSION_THRESHOLD) {
      setFiles((prev) =>
        prev.map((f, i) => i === index ? { ...f, compressing: true, error: null } : f)
      );

      try {
        fileToUpload = await compressImage(file.file, 1920, 1920, 0.85);
      } catch (compressionError) {
        console.warn("Compression failed, uploading original:", compressionError);
        fileToUpload = file.file;
      }

      setFiles((prev) =>
        prev.map((f, i) => i === index ? { ...f, compressing: false } : f)
      );
    }

    // Update state to uploading
    setFiles((prev) =>
      prev.map((f, i) => i === index ? { ...f, uploading: true, error: null, progress: 0 } : f)
    );

    try {
      const photo = await repairLogsApi.uploadPhoto(
        workspaceId,
        repairLogId,
        fileToUpload,
        file.photoType,
        file.caption || undefined,
        (percentage) => {
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, progress: percentage } : f
            )
          );
        }
      );

      if (photo) {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, uploading: false, uploaded: true, progress: 100, photo }
              : f
          )
        );
      } else {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, uploading: false, error: tPhotos("uploadFailed") }
              : f
          )
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : tPhotos("uploadFailed");
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, uploading: false, error: errorMsg }
            : f
        )
      );
    }
  };

  const uploadAll = async () => {
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      if (!files[i]?.uploaded && !files[i]?.uploading && !files[i]?.compressing) {
        await uploadFile(i);
      }
    }

    setIsUploading(false);

    setFiles((currentFiles) => {
      const uploadedPhotos = currentFiles.filter((f) => f.uploaded && f.photo);
      const failedCount = currentFiles.filter((f) => f.error).length;

      if (uploadedPhotos.length > 0) {
        toast.success(tPhotos("uploadSuccess", { count: uploadedPhotos.length }));
        onPhotosChange();

        setTimeout(() => {
          setFiles((prev) => prev.filter((f) => !f.uploaded));
        }, 2000);
      }

      if (failedCount > 0) {
        toast.error(tPhotos("someUploadsFailed", { count: failedCount }));
      }

      return currentFiles;
    });
  };

  const handleDeletePhoto = async () => {
    if (!photoToDelete) return;

    try {
      setIsDeleting(true);
      await repairLogsApi.deletePhoto(workspaceId, repairLogId, photoToDelete.id);
      toast.success(t("deleteSuccess"));
      onPhotosChange();
      setDeleteDialogOpen(false);
      setPhotoToDelete(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete photo";
      toast.error(t("error"), { description: errorMessage });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (photo: RepairPhoto) => {
    setPhotoToDelete(photo);
    setDeleteDialogOpen(true);
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, [addFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    addFiles(selectedFiles);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [addFiles]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const hasFiles = files.length > 0;
  const canUpload = hasFiles && !isUploading && files.some((f) => !f.uploaded && !f.compressing);
  const hasExistingPhotos = photos.length > 0;

  return (
    <div className="space-y-4">
      {/* Existing Photos by Type */}
      {hasExistingPhotos && (
        <div className="space-y-4">
          {(["BEFORE", "DURING", "AFTER"] as RepairPhotoType[]).map((type) => {
            const typePhotos = photosByType[type];
            if (typePhotos.length === 0) return null;

            const config = PHOTO_TYPE_CONFIG[type];
            const Icon = config.icon;

            return (
              <Card key={type}>
                <CardHeader className="py-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Badge className={config.color}>
                      <Icon className="h-3 w-3 mr-1" />
                      {t(type === "BEFORE" ? "beforePhotos" : type === "DURING" ? "duringPhotos" : "afterPhotos")}
                    </Badge>
                    <span className="text-muted-foreground">({typePhotos.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {typePhotos.map((photo) => (
                      <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                        <img
                          src={photo.thumbnail_url}
                          alt={photo.caption || photo.filename}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDeleteDialog(photo)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                            {photo.caption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!hasExistingPhotos && (
        <p className="text-sm text-muted-foreground text-center py-4">{t("noPhotos")}</p>
      )}

      {/* Photo Type Selector */}
      <div className="flex items-center gap-2">
        <Label htmlFor="photoType" className="text-sm">{t("uploadPhoto")} as:</Label>
        <Select value={selectedPhotoType} onValueChange={(value) => setSelectedPhotoType(value as RepairPhotoType)}>
          <SelectTrigger id="photoType" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["BEFORE", "DURING", "AFTER"] as RepairPhotoType[]).map((type) => {
              const config = PHOTO_TYPE_CONFIG[type];
              const Icon = config.icon;
              return (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{t(type === "BEFORE" ? "beforePhotos" : type === "DURING" ? "duringPhotos" : "afterPhotos")}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Drop Zone */}
      <Card
        ref={dropZoneRef}
        className={`transition-colors cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-dashed hover:border-primary/50"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className={`rounded-full p-3 mb-3 ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
            <Upload className={`h-6 w-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          </div>

          <h4 className="text-sm font-semibold mb-1">
            {isDragging ? tPhotos("dropFiles") : t("uploadPhoto")}
          </h4>

          <p className="text-xs text-muted-foreground mb-3">
            {tPhotos("instructions")}
          </p>

          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleBrowseClick();
            }}
            disabled={isProcessing}
          >
            <ImagePlus className="h-4 w-4 mr-2" />
            {tPhotos("browse")}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileInputChange}
            className="sr-only"
          />
        </CardContent>
      </Card>

      {/* Preview Grid */}
      {hasFiles && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {tPhotos("selectedFiles", { count: files.length })}
            </span>
            {canUpload && (
              <Button onClick={uploadAll} disabled={isProcessing} size="sm">
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {tPhotos("uploading")}
                  </>
                ) : (
                  tPhotos("uploadAll")
                )}
              </Button>
            )}
          </div>

          {isProcessing && files.length > 1 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{tPhotos("overallProgress")}</span>
                <span>{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {files.map((file, index) => (
              <Card key={`${file.file.name}-${index}`} className="overflow-hidden">
                <div className="flex gap-3 p-3">
                  <div className="relative w-20 h-20 rounded bg-muted flex-shrink-0">
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-full h-full object-cover rounded"
                    />
                    {file.compressing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      </div>
                    )}
                    {file.uploading && !file.compressing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                        <span className="text-xs text-white font-medium">{file.progress}%</span>
                      </div>
                    )}
                    {file.uploaded && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      </div>
                    )}
                    {file.error && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.file.size)}</p>
                      </div>
                      {!file.uploading && !file.uploaded && !file.compressing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {!file.uploaded && !file.uploading && !file.compressing && (
                      <>
                        <Select
                          value={file.photoType}
                          onValueChange={(value) => updatePhotoType(index, value as RepairPhotoType)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["BEFORE", "DURING", "AFTER"] as RepairPhotoType[]).map((type) => (
                              <SelectItem key={type} value={type}>
                                {t(type === "BEFORE" ? "beforePhotos" : type === "DURING" ? "duringPhotos" : "afterPhotos")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="text"
                          placeholder={tPhotos("captionPlaceholder")}
                          value={file.caption}
                          onChange={(e) => updateCaption(index, e.target.value)}
                          className="h-7 text-xs"
                        />
                      </>
                    )}

                    {file.uploading && !file.compressing && (
                      <Progress value={file.progress} className="h-1.5" />
                    )}

                    {file.error && (
                      <Alert variant="destructive" className="py-1 px-2">
                        <AlertDescription className="text-xs">{file.error}</AlertDescription>
                      </Alert>
                    )}

                    {file.uploaded && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-xs">{tPhotos("uploaded")}</span>
                      </div>
                    )}

                    {file.error && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => uploadFile(index)}
                      >
                        {tPhotos("retry")}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tPhotos("gallery.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tPhotos("gallery.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tPhotos("gallery.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePhoto}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? tPhotos("gallery.deleting") : tPhotos("gallery.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
