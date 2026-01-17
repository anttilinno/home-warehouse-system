"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePhotoUpload } from "@/lib/hooks/use-photo-upload";
import { validateImageFile, createImagePreview, revokeImagePreview, formatFileSize } from "@/lib/utils/image";
import type { ItemPhoto } from "@/lib/types/item-photo";

interface PhotoUploadProps {
  workspaceId: string;
  itemId: string;
  onUploadComplete?: (photos: ItemPhoto[]) => void;
  maxFiles?: number;
}

interface PreviewFile {
  file: File;
  preview: string;
  caption: string;
  uploading: boolean;
  progress: number;
  uploaded: boolean;
  error: string | null;
  photo?: ItemPhoto;
}

export function PhotoUpload({
  workspaceId,
  itemId,
  onUploadComplete,
  maxFiles = 10
}: PhotoUploadProps) {
  const t = useTranslations("photos.upload");
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload } = usePhotoUpload({
    workspaceId,
    itemId,
    onSuccess: () => {
      // Handle success in uploadFile function
    },
    onError: (error) => {
      toast.error(t("uploadError"), { description: error });
    },
  });

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

  const uploadFile = async (index: number) => {
    const file = files[index];
    if (!file || file.uploaded || file.uploading) return;

    // Update state to uploading
    setFiles((prev) =>
      prev.map((f, i) => i === index ? { ...f, uploading: true, error: null } : f)
    );

    try {
      const photo = await upload(file.file, file.caption || undefined);

      if (photo) {
        // Success - update file state
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, uploading: false, uploaded: true, progress: 100, photo }
              : f
          )
        );
      } else {
        // Upload failed but didn't throw
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, uploading: false, error: t("uploadFailed") }
              : f
          )
        );
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
    }
  };

  const uploadAll = async () => {
    setIsUploading(true);

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      if (!files[i]?.uploaded && !files[i]?.uploading) {
        await uploadFile(i);
      }
    }

    setIsUploading(false);

    // Check results and notify
    const uploadedPhotos = files.filter((f) => f.uploaded && f.photo).map((f) => f.photo!);
    const failedCount = files.filter((f) => !f.uploaded && !f.uploading).length;

    if (uploadedPhotos.length > 0) {
      toast.success(t("uploadSuccess", { count: uploadedPhotos.length }));
      onUploadComplete?.(uploadedPhotos);

      // Clear uploaded files after a delay
      setTimeout(() => {
        setFiles((prev) => prev.filter((f) => !f.uploaded));
      }, 2000);
    }

    if (failedCount > 0) {
      toast.error(t("someUploadsFailed", { count: failedCount }));
    }
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
  const hasUploadedFiles = files.some((f) => f.uploaded);
  const canUpload = hasFiles && !isUploading && files.some((f) => !f.uploaded);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={`transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-dashed"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className={`rounded-full p-3 mb-4 ${
            isDragging ? "bg-primary/10" : "bg-muted"
          }`}>
            <Upload className={`h-8 w-8 ${
              isDragging ? "text-primary" : "text-muted-foreground"
            }`} />
          </div>

          <h3 className="text-lg font-semibold mb-2">
            {isDragging ? t("dropFiles") : t("title")}
          </h3>

          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            {t("instructions")}
          </p>

          <Button
            type="button"
            onClick={handleBrowseClick}
            disabled={isUploading}
            aria-label={t("browse")}
          >
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
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {t("selectedFiles", { count: files.length })}
            </h4>
            {canUpload && (
              <Button
                onClick={uploadAll}
                disabled={isUploading}
                size="sm"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("uploading")}
                  </>
                ) : (
                  t("uploadAll")
                )}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file, index) => (
              <Card key={`${file.file.name}-${index}`} className="overflow-hidden">
                <div className="relative aspect-square bg-muted">
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Status Overlay */}
                  {file.uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  )}

                  {file.uploaded && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                  )}

                  {file.error && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-destructive" />
                    </div>
                  )}

                  {/* Remove Button */}
                  {!file.uploading && !file.uploaded && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 h-8 w-8 p-0"
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
                  {!file.uploaded && (
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
                        disabled={file.uploading}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}

                  {/* Progress Bar */}
                  {file.uploading && (
                    <div className="space-y-1">
                      <Progress value={file.progress} className="h-1" />
                      <p className="text-xs text-muted-foreground text-center">
                        {file.progress}%
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
                      className="w-full h-7 text-xs"
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
    </div>
  );
}
