'use client';

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { getPendingMutationsCount } from '@/lib/pwa';
import { workspaceStorage } from '@/lib/api';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  showPendingCount?: boolean;
}

export function OfflineIndicator({ className, showPendingCount = true }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!showPendingCount) return;

    const updatePendingCount = async () => {
      const workspaceId = workspaceStorage.getWorkspaceId();
      if (workspaceId) {
        const count = await getPendingMutationsCount(workspaceId);
        setPendingCount(count);
      }
    };

    updatePendingCount();

    // Update every 5 seconds
    const interval = setInterval(updatePendingCount, 5000);

    return () => clearInterval(interval);
  }, [showPendingCount]);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs rounded-md px-2 py-1',
        !isOnline
          ? 'bg-destructive/10 text-destructive'
          : 'bg-warning/10 text-warning',
        className
      )}
    >
      {!isOnline ? (
        <>
          <Icon name="WifiOff" className="h-3 w-3" />
          <span>Offline</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <Icon name="CloudUpload" className="h-3 w-3" />
          <span>{pendingCount} pending</span>
        </>
      ) : null}
    </div>
  );
}
