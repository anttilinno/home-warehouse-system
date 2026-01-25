"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateImageFile, createImagePreview, revokeImagePreview, formatFileSize, compressImage } from "@/lib/utils/image";
import type { ItemPhoto, DuplicateCheckResponse } from "@/lib/types/item-photo";
import { DuplicateWarningDialog } from "./duplicate-warning-dialog";

interface PhotoUploadProps {
  workspaceId: string;
  itemId: string;
  onUploadComplete?: (photos: ItemPhoto[]) => void;
  maxFiles?: number;
  /** Enable automatic compression for files larger than this size (bytes). Default: 2MB */
  compressionThreshold?: number;
}

interface PreviewFile {
  file: File;
  preview: string;
  caption: string;
  uploading: boolean;
  compressing: boolean;
  progress: number;
  uploaded: boolean;
  error: string | null;
  photo?: ItemPhoto;
}

/** Compression threshold default: 2MB */
const DEFAULT_COMPRESSION_THRESHOLD = 2 * 1024 * 1024;

export function PhotoUpload({
  workspaceId,
  itemId,
  onUploadComplete,
  maxFiles = 10,
  compressionThreshold = DEFAULT_COMPRESSION_THRESHOLD
}: PhotoUploadProps) {
  const t = useTranslations("photos.upload");
  const tDup = useTranslations("photos.duplicates");
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState("");

  // Duplicate detection state
  const [pendingUploadIndex, setPendingUploadIndex] = useState<number | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResponse | null>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (files.length === 0) return 0;
    const pendingFiles = files.filter((f) => !f.uploaded);
    if (pendingFiles.length === 0) return 100;
    const totalProgress = files.reduce((sum, f) => sum + f.progress, 0);
    return Math.round(totalProgress / files.length);
  }, [files]);

  // Count stats for display
  const uploadingCount = files.filter((f) => f.uploading).length;
  const compressingCount = files.filter((f) => f.compressing).length;
  const uploadedCount = files.filter((f) => f.uploaded).length;
  const errorCount = files.filter((f) => f.error).length;

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => revokeImagePreview(f.preview));
    };
  }, [files]);

  const addFiles = useCallback((newFiles: File[]) => {
    // Validate and create previews for new files
    const validFiles: PreviewFile[] = [];

    for (const file of newFiles) {
      // Check if file limit is reached
      if (files.length + validFiles.length >= maxFiles) {
        toast.error(t("tooManyFiles", { max: maxFiles }));
        break;
      }

      // Validate file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast.error(t("invalidFile"), { description: validation.error });
        continue;
      }

      // Check for duplicates
      const isDuplicate = files.some((f) =>
        f.file.name === file.name && f.file.size === file.size
      );
      if (isDuplicate) {
        toast.error(t("duplicateFile"), { description: file.name });
        continue;
      }

      // Create preview
      validFiles.push({
        file,
        preview: createImagePreview(file),
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
  }, [files, maxFiles, t]);

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

  // Internal upload function that skips duplicate check
  const uploadFileInternal = async (index: number) => {
    const file = files[index];
    if (!file || file.uploaded || file.uploading || file.compressing) return;

    let fileToUpload = file.file;

    // Compress large files first
    if (file.file.size > compressionThreshold) {
      setFiles((prev) =>
        prev.map((f, i) => i === index ? { ...f, compressing: true, error: null } : f)
      );
      setStatusAnnouncement(t("compressing", { name: file.file.name }));

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
    setStatusAnnouncement(t("uploadingFile", { name: file.file.name }));

    try {
      // Use the API directly to get per-file progress tracking
      const { itemPhotosApi } = await import("@/lib/api/item-photos");

      const photo = await itemPhotosApi.uploadItemPhoto(
        workspaceId,
        itemId,
        fileToUpload,
        file.caption || undefined,
        (percentage) => {
          // Update progress for this specific file
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, progress: percentage } : f
            )
          );
        }
      );

      if (photo) {
        // Success - update file state and announce
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, uploading: false, uploaded: true, progress: 100, photo }
              : f
          )
        );
        setStatusAnnouncement(t("fileUploaded", { name: file.file.name }));
      } else {
        // Upload failed but didn't throw
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, uploading: false, error: t("uploadFailed") }
              : f
          )
        );
        setStatusAnnouncement(t("fileUploadFailed", { name: file.file.name }));
      }
    } catch (error) {
      // Upload threw an error
      const errorMsg = error instanceof Error ? error.message : t("uploadFailed");
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, uploading: false, error: errorMsg }
            : f
        )
      );
      setStatusAnnouncement(t("fileUploadFailed", { name: file.file.name }));
    }
  };

  // Upload file with duplicate check
  const uploadFile = async (index: number) => {
    const file = files[index];
    if (!file || file.uploaded || file.uploading || file.compressing) return;

    // Check for duplicates before upload
    setIsCheckingDuplicate(true);
    try {
      const { itemPhotosApi } = await import("@/lib/api/item-photos");
      const duplicateResult = await itemPhotosApi.checkDuplicates(workspaceId, itemId, file.file);

      if (duplicateResult.duplicates.length > 0) {
        // Store pending upload and show warning
        setPendingUploadIndex(index);
        setDuplicateInfo(duplicateResult);
        setShowDuplicateWarning(true);
        setIsCheckingDuplicate(false);
        return; // Don't upload yet - wait for user decision
      }
    } catch (err) {
      // If duplicate check fails, proceed with upload anyway
      console.warn("Duplicate check failed:", err);
    }
    setIsCheckingDuplicate(false);

    // No duplicates found, proceed with upload
    await uploadFileInternal(index);
  };

  // Handle proceeding after duplicate warning
  const handleProceedWithUpload = async () => {
    setShowDuplicateWarning(false);
    if (pendingUploadIndex !== null) {
      // Continue with upload (skip duplicate check this time)
      await uploadFileInternal(pendingUploadIndex);
    }
    setPendingUploadIndex(null);
    setDuplicateInfo(null);
  };

  // Handle cancel duplicate warning
  const handleCancelDuplicateUpload = () => {
    setShowDuplicateWarning(false);
    setPendingUploadIndex(null);
    setDuplicateInfo(null);
  };

  const uploadAll = async () => {
    setIsUploading(true);
    const totalToUpload = files.filter((f) => !f.uploaded).length;
    setStatusAnnouncement(t("startingUpload", { count: totalToUpload }));

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      if (!files[i]?.uploaded && !files[i]?.uploading && !files[i]?.compressing) {
        await uploadFile(i);
      }
    }

    setIsUploading(false);

    // Check results and notify - use current state from the callback
    setFiles((currentFiles) => {
      const uploadedPhotos = currentFiles.filter((f) => f.uploaded && f.photo).map((f) => f.photo!);
      const failedCount = currentFiles.filter((f) => f.error).length;

      if (uploadedPhotos.length > 0) {
        toast.success(t("uploadSuccess", { count: uploadedPhotos.length }));
        setStatusAnnouncement(t("allUploadsComplete", { count: uploadedPhotos.length }));
        onUploadComplete?.(uploadedPhotos);

        // Clear uploaded files after a delay
        setTimeout(() => {
          setFiles((prev) => prev.filter((f) => !f.uploaded));
        }, 2000);
      }

      if (failedCount > 0) {
        toast.error(t("someUploadsFailed", { count: failedCount }));
      }

      return currentFiles;
    });
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set dragging to false if leaving the drop zone entirely
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

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [addFiles]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const hasFiles = files.length > 0;
  const canUpload = hasFiles && !isUploading && files.some((f) => !f.uploaded && !f.compressing);
  const isProcessing = isUploading || compressingCount > 0 || uploadingCount > 0;

  // Handle keyboard navigation for drop zone
  const handleDropZoneKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusAnnouncement}
      </div>

      {/* Drop Zone */}
      <Card
        ref={dropZoneRef}
        className={`transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-dashed hover:border-primary/50"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        onKeyDown={handleDropZoneKeyDown}
        tabIndex={0}
        role="button"
        aria-label={t("dropZoneLabel")}
        aria-describedby="drop-zone-description"
      >
        <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
          <div className={`rounded-full p-3 sm:p-4 mb-4 ${
            isDragging ? "bg-primary/10" : "bg-muted"
          }`}>
            <Upload className={`h-6 w-6 sm:h-8 sm:w-8 ${
              isDragging ? "text-primary" : "text-muted-foreground"
            }`} />
          </div>

          <h3 className="text-base sm:text-lg font-semibold mb-2">
            {isDragging ? t("dropFiles") : t("title")}
          </h3>

          <p id="drop-zone-description" className="text-sm text-muted-foreground mb-4 max-w-sm px-4">
            {t("instructions")}
          </p>

          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleBrowseClick();
            }}
            disabled={isProcessing}
            className="touch-manipulation"
          >
            <ImagePlus className="h-4 w-4 mr-2" />
            {t("browse")}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileInputChange}
            className="sr-only"
            aria-label={t("fileInput")}
          />

          <p className="text-xs text-muted-foreground mt-4">
            {t("acceptedFormats")}
          </p>
        </CardContent>
      </Card>

      {/* Preview Grid */}
      {hasFiles && (
        <div className="space-y-4">
          {/* Header with stats and action button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">
                {t("selectedFiles", { count: files.length })}
              </h4>
              {/* Status summary */}
              {(uploadedCount > 0 || errorCount > 0) && (
                <p className="text-xs text-muted-foreground">
                  {uploadedCount > 0 && (
                    <span className="text-green-600 dark:text-green-500">
                      {t("uploadedCount", { count: uploadedCount })}
                    </span>
                  )}
                  {uploadedCount > 0 && errorCount > 0 && " · "}
                  {errorCount > 0 && (
                    <span className="text-destructive">
                      {t("failedCount", { count: errorCount })}
                    </span>
                  )}
                </p>
              )}
            </div>
            {canUpload && (
              <Button
                onClick={uploadAll}
                disabled={isProcessing}
                size="sm"
                className="w-full sm:w-auto touch-manipulation"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {compressingCount > 0 ? t("compressingFiles") : t("uploading")}
                  </>
                ) : (
                  t("uploadAll")
                )}
              </Button>
            )}
          </div>

          {/* Overall progress bar when uploading multiple files */}
          {isProcessing && files.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("overallProgress")}</span>
                <span>{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {files.map((file, index) => (
              <Card
                key={`${file.file.name}-${index}`}
                className="overflow-hidden"
                role="article"
                aria-label={t("fileCard", { name: file.file.name })}
              >
                <div className="relative aspect-square bg-muted">
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Status Overlay - Compressing */}
                  {file.compressing && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                      <span className="text-xs text-white font-medium">{t("compressingLabel")}</span>
                    </div>
                  )}

                  {/* Status Overlay - Uploading */}
                  {file.uploading && !file.compressing && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                      <span className="text-xs text-white font-medium">{file.progress}%</span>
                    </div>
                  )}

                  {/* Status Overlay - Uploaded */}
                  {file.uploaded && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                  )}

                  {/* Status Overlay - Error */}
                  {file.error && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-destructive" />
                    </div>
                  )}

                  {/* Remove Button */}
                  {!file.uploading && !file.uploaded && !file.compressing && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 h-9 w-9 sm:h-8 sm:w-8 p-0 touch-manipulation"
                      onClick={() => removeFile(index)}
                      aria-label={t("removeFile")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <CardContent className="p-3 space-y-2">
                  {/* File Info */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium truncate" title={file.file.name}>
                      {file.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.file.size)}
                    </p>
                  </div>

                  {/* Caption Input */}
                  {!file.uploaded && !file.uploading && !file.compressing && (
                    <div className="space-y-1">
                      <Label htmlFor={`caption-${index}`} className="text-xs">
                        {t("caption")}
                      </Label>
                      <Input
                        id={`caption-${index}`}
                        type="text"
                        placeholder={t("captionPlaceholder")}
                        value={file.caption}
                        onChange={(e) => updateCaption(index, e.target.value)}
                        disabled={file.uploading || file.compressing}
                        className="h-9 sm:h-8 text-sm sm:text-xs"
                      />
                    </div>
                  )}

                  {/* Compression Progress */}
                  {file.compressing && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">{t("compressingLabel")}</span>
                    </div>
                  )}

                  {/* Upload Progress Bar */}
                  {file.uploading && !file.compressing && (
                    <div className="space-y-1">
                      <Progress value={file.progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground text-center">
                        {t("uploadingProgress", { progress: file.progress })}
                      </p>
                    </div>
                  )}

                  {/* Error Message */}
                  {file.error && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        {file.error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Success Message */}
                  {file.uploaded && (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-500">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-xs font-medium">{t("uploaded")}</span>
                    </div>
                  )}

                  {/* Retry Button */}
                  {file.error && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-9 sm:h-7 text-sm sm:text-xs touch-manipulation"
                      onClick={() => uploadFile(index)}
                    >
                      {t("retry")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate warning dialog */}
      <DuplicateWarningDialog
        open={showDuplicateWarning}
        onOpenChange={setShowDuplicateWarning}
        duplicates={duplicateInfo?.duplicates ?? []}
        hasExact={duplicateInfo?.has_exact ?? false}
        onProceed={handleProceedWithUpload}
        onCancel={handleCancelDuplicateUpload}
        isUploading={isCheckingDuplicate}
      />
    </div>
  );
}
