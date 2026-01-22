"use client";

import { useOffline } from "@/lib/contexts/offline-context";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudOff, RefreshCw, Check } from "lucide-react";

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

/**
 * SyncStatusIndicator displays the current sync status in a compact badge format.
 *
 * States:
 * - Offline: Shows "Offline" with cloud-off icon
 * - Syncing: Shows "Syncing..." with spinning refresh icon
 * - Synced: Shows relative time (e.g., "2m ago") with green checkmark, clickable to trigger sync
 * - Not synced: Shows "Not synced" with cloud icon
 */
export function SyncStatusIndicator() {
  const { isOnline, isSyncing, lastSyncTimestamp, triggerSync } = useOffline();

  // Offline state
  if (!isOnline) {
    return (
      <Badge variant="secondary" className="gap-1.5 text-xs">
        <CloudOff className="h-3 w-3" />
        Offline
      </Badge>
    );
  }

  // Syncing state
  if (isSyncing) {
    return (
      <Badge variant="secondary" className="gap-1.5 text-xs">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Syncing...
      </Badge>
    );
  }

  // Synced state with timestamp
  if (lastSyncTimestamp) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 text-xs cursor-pointer hover:bg-accent"
        onClick={triggerSync}
        title="Click to sync now"
      >
        <Check className="h-3 w-3 text-green-500" />
        {formatRelativeTime(lastSyncTimestamp)}
      </Badge>
    );
  }

  // Never synced (or loading)
  return (
    <Badge variant="outline" className="gap-1.5 text-xs">
      <Cloud className="h-3 w-3" />
      Not synced
    </Badge>
  );
}
