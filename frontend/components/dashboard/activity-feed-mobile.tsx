'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { useSSE, type SSEEvent } from '@/lib/hooks/use-sse';
import { useAuth } from '@/lib/contexts/auth-context';
import { ActivityFeed } from './activity-feed';

export function ActivityFeedMobile() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Track unread count
  useSSE({
    onEvent: (event: SSEEvent) => {
      // Skip own events
      if (event.user_id === user?.id) return;

      // Increment unread if sheet is closed
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    }
  });

  // Handle sheet open/close
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    // Reset unread count when sheet opens
    if (open) {
      setUnreadCount(0);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="icon"
          className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
        >
          <Activity className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] p-0">
        <div className="h-full flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Workspace Activity</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ActivityFeed />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
