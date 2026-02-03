"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { Upload, X, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  onUpdate?: () => void;
}

export function AvatarUpload({ onUpdate }: AvatarUploadProps) {
  const t = useTranslations("settings.account.avatar");
  const { user, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(t("invalidType"));
      return;
    }
    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("tooLarge"));
      return;
    }

    setIsUploading(true);
    try {
      await authApi.uploadAvatar(file);
      await refreshUser();
      onUpdate?.();
      toast.success(t("uploadSuccess"));
    } catch {
      toast.error(t("uploadError"));
    } finally {
      setIsUploading(false);
    }
  }, [t, refreshUser, onUpdate]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await authApi.deleteAvatar();
      await refreshUser();
      onUpdate?.();
      toast.success(t("deleteSuccess"));
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [handleFile]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const isLoading = isUploading || isDeleting;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar with drop zone */}
      <div
        className={cn(
          "relative cursor-pointer rounded-full transition-all",
          isDragging && "ring-2 ring-primary ring-offset-2",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={isLoading ? undefined : handleClick}
        role="button"
        tabIndex={isLoading ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isLoading) handleClick();
          }
        }}
        aria-label={user?.avatar_url ? t("change") : t("upload")}
      >
        <Avatar className="h-24 w-24">
          <AvatarImage
            src={user?.avatar_url || undefined}
            alt={user?.full_name || "User avatar"}
          />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>

        {/* Upload overlay */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity",
          "hover:opacity-100",
          isDragging && "opacity-100"
        )}>
          {isUploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Upload className="h-6 w-6 text-white" />
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={isLoading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("upload")}
            </>
          ) : (
            user?.avatar_url ? t("change") : t("upload")
          )}
        </Button>

        {user?.avatar_url && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isLoading}
            className="text-destructive hover:text-destructive"
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <X className="mr-2 h-4 w-4" />
            )}
            {t("remove")}
          </Button>
        )}
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center max-w-[200px]">
        {t("dropHere")}
      </p>
    </div>
  );
}
