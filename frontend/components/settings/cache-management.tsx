"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOffline } from "@/lib/contexts/offline-context";
import { deleteDB } from "@/lib/db/offline-db";
import { toast } from "sonner";

export function CacheManagement() {
  const t = useTranslations("settings.dataStorage.cacheManagement");
  const { persistentStorage } = useOffline();
  const [isPersistent, setIsPersistent] = useState(persistentStorage);
  const [isRequesting, setIsRequesting] = useState(false);

  const handleClearCache = async () => {
    try {
      // Delete the offline database
      await deleteDB();

      // Clear all service worker caches
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      // Delete the PhotoUploadQueue database
      if (typeof indexedDB !== "undefined") {
        indexedDB.deleteDatabase("PhotoUploadQueue");
      }

      toast.success(t("clearCacheSuccess"));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("[CacheManagement] Failed to clear cache:", error);
      toast.error("Failed to clear cache");
    }
  };

  const handleRequestPersistent = async () => {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      return;
    }

    setIsRequesting(true);
    try {
      const granted = await navigator.storage.persist();
      if (granted) {
        setIsPersistent(true);
        toast.success(t("persistentSuccess"));
      } else {
        toast.info(t("persistentDenied"));
      }
    } catch {
      toast.error("Failed to request persistent storage");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section A - Clear Offline Cache */}
        <div className="space-y-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                {t("clearCache")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("clearCacheConfirmTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("clearCacheConfirmDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("clearCacheCancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearCache}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("clearCacheConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Section B - Persistent Storage */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {t("persistentStorage")}
            </span>
            <Badge variant={isPersistent ? "default" : "secondary"}>
              {isPersistent ? t("persistentGranted") : t("persistentNotGranted")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("persistentStorageDesc")}
          </p>
          {!isPersistent && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestPersistent}
              disabled={isRequesting}
            >
              {t("requestPersistent")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
