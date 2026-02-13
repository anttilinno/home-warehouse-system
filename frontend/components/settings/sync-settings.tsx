"use client";

import { useTranslations } from "next-intl";
import { RefreshCw, Wifi, WifiOff, Clock, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOffline } from "@/lib/contexts/offline-context";
import { useDateFormat } from "@/lib/hooks/use-date-format";
import { useTimeFormat } from "@/lib/hooks/use-time-format";

/**
 * Formats a timestamp into a human-readable relative time string.
 * Examples: "just now", "2m ago", "1h ago", "3d ago"
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function SyncSettings() {
  const t = useTranslations("settings.dataStorage.sync");
  const {
    triggerSync,
    isSyncing,
    lastSyncTimestamp,
    syncError,
    isOnline,
    pendingMutationCount,
    isMutationSyncing,
    processMutationQueue,
  } = useOffline();
  const { formatDateTime } = useDateFormat();
  const { formatTime } = useTimeFormat();

  const isBusy = isSyncing || isMutationSyncing;

  const handleSync = async () => {
    await triggerSync();
    await processMutationQueue();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1 - Sync Now button */}
        <div>
          <Button
            onClick={handleSync}
            disabled={!isOnline || isBusy}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isBusy ? "animate-spin" : ""}`}
            />
            {isBusy ? t("syncing") : t("syncNow")}
          </Button>
        </div>

        {/* Row 2 - Last sync timestamp */}
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{t("lastSync")}:</span>{" "}
          {lastSyncTimestamp ? (
            <>
              {formatDateTime(new Date(lastSyncTimestamp))} (
              {formatRelativeTime(lastSyncTimestamp)})
            </>
          ) : (
            t("neverSynced")
          )}
        </div>

        {/* Row 3 - Status indicators */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <span>{isOnline ? t("online") : t("offline")}</span>
          </div>

          {pendingMutationCount > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {t("pendingMutations", { count: pendingMutationCount })}
              </span>
            </div>
          )}
        </div>

        {/* Sync error alert */}
        {syncError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t("syncError")}: {syncError}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
