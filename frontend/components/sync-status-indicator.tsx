"use client";

import { useState } from "react";
import { useOffline } from "@/lib/contexts/offline-context";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudOff, RefreshCw, Check, Clock } from "lucide-react";
import { PendingChangesDrawer } from "./pending-changes-drawer";

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
 * - Offline: Shows "Offline" with cloud-off icon and pending count
 * - Syncing: Shows "Syncing..." with spinning refresh icon and pending count
 * - Pending: Shows "{count} pending" with clock icon, clickable to open drawer
 * - Synced: Shows relative time (e.g., "2m ago") with green checkmark, clickable to trigger sync
 * - Not synced: Shows "Not synced" with cloud icon
 */
export function SyncStatusIndicator() {
  const {
    isOnline,
    isSyncing,
    lastSyncTimestamp,
    triggerSync,
    pendingMutationCount,
    isMutationSyncing,
  } = useOffline();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Offline state - highest priority
  if (!isOnline) {
    return (
      <>
        <Badge
          variant="secondary"
          className="gap-1.5 text-xs cursor-pointer hover:bg-accent"
          onClick={() => pendingMutationCount > 0 && setDrawerOpen(true)}
          title={pendingMutationCount > 0 ? "Click to view pending changes" : undefined}
        >
          <CloudOff className="h-3 w-3" />
          Offline
          {pendingMutationCount > 0 && (
            <span className="ml-1 rounded-full bg-yellow-500 px-1.5 text-[10px] text-white">
              {pendingMutationCount}
            </span>
          )}
        </Badge>
        <PendingChangesDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      </>
    );
  }

  // Syncing state (either data sync or mutation sync)
  if (isSyncing || isMutationSyncing) {
    return (
      <>
        <Badge
          variant="secondary"
          className="gap-1.5 text-xs cursor-pointer hover:bg-accent"
          onClick={() => pendingMutationCount > 0 && setDrawerOpen(true)}
          title={pendingMutationCount > 0 ? "Click to view pending changes" : undefined}
        >
          <RefreshCw className="h-3 w-3 animate-spin" />
          Syncing...
          {pendingMutationCount > 0 && (
            <span className="ml-1 rounded-full bg-blue-500 px-1.5 text-[10px] text-white">
              {pendingMutationCount}
            </span>
          )}
        </Badge>
        <PendingChangesDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      </>
    );
  }

  // Has pending changes
  if (pendingMutationCount > 0) {
    return (
      <>
        <Badge
          variant="secondary"
          className="gap-1.5 text-xs cursor-pointer hover:bg-accent"
          onClick={() => setDrawerOpen(true)}
          title="Click to view pending changes"
        >
          <Clock className="h-3 w-3 text-yellow-500" />
          {pendingMutationCount} pending
        </Badge>
        <PendingChangesDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      </>
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
