'use client';

import { useState, useRef } from 'react';
import { useSSE, type SSEEvent } from '@/lib/hooks/use-sse';
import { useAuth } from '@/lib/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Activity as ActivityIcon,
  Pause,
  Play
} from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: string;
  userName: string;
  message: string;
  timestamp: Date;
  icon: string;
  color: string;
}

export function ActivityFeed() {
  const { user } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to SSE events
  useSSE({
    onEvent: (event: SSEEvent) => {
      // Skip own events (less noisy)
      if (event.user_id === user?.id) return;

      // Skip if paused
      if (isPaused) return;

      const activityEvent = formatActivityEvent(event);

      // Keep only last 50 events (ephemeral)
      setEvents((prev) => [activityEvent, ...prev].slice(0, 50));

      // Auto-scroll to top
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
  });

  return (
    <Card className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Activity</h3>
          {events.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({events.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Pause/Resume */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume' : 'Pause'}
            className="h-8 w-8 p-0"
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>

          {/* Collapse/Expand */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 p-0"
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>

          {/* Clear */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEvents([])}
            disabled={events.length === 0}
            title="Clear all"
            className="h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <ActivityIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Live updates appear here
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-1">
              {events.map((event, index) => (
                <ActivityLogEntry
                  key={event.id}
                  event={event}
                  isNew={index === 0}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {!isCollapsed && events.length > 0 && (
        <div className="px-3 py-2 border-t bg-muted/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last {events.length} events</span>
            {isPaused && (
              <span className="text-amber-600 flex items-center gap-1">
                <Pause className="h-3 w-3" />
                Paused
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ActivityLogEntry({
  event,
  isNew
}: {
  event: ActivityEvent;
  isNew: boolean;
}) {
  return (
    <div
      className={`
        flex items-start gap-2 px-2 py-1.5 rounded text-sm
        hover:bg-muted/50 transition-colors
        ${isNew ? 'bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300' : ''}
      `}
    >
      {/* Icon */}
      <span className="shrink-0 text-base" title={event.type}>
        {event.icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className={`font-medium ${event.color}`}>
          {event.userName}
        </span>
        {' '}
        <span className="text-muted-foreground">
          {event.message}
        </span>
      </div>

      {/* Timestamp */}
      <span className="text-xs text-muted-foreground shrink-0">
        {formatDistanceToNow(event.timestamp, {
          addSuffix: false,
          includeSeconds: true
        })}
      </span>
    </div>
  );
}

function formatActivityEvent(event: SSEEvent): ActivityEvent {
  const action = event.type.split('.')[1];
  const entityName = event.data?.name || event.entity_type;
  const userName = event.data?.user_name || 'Someone';

  // Action templates with icons and colors
  const templates: Record<string, { message: string; icon: string; color: string }> = {
    'item.created': {
      message: `added item "${entityName}"`,
      icon: '✨',
      color: 'text-green-600 dark:text-green-400'
    },
    'item.updated': {
      message: `updated "${entityName}"`,
      icon: '✏️',
      color: 'text-blue-600 dark:text-blue-400'
    },
    'item.deleted': {
      message: `deleted "${entityName}"`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
    'inventory.created': {
      message: `added inventory for "${entityName}"`,
      icon: '📦',
      color: 'text-green-600 dark:text-green-400'
    },
    'inventory.updated': {
      message: `updated inventory`,
      icon: '📦',
      color: 'text-blue-600 dark:text-blue-400'
    },
    'inventory.deleted': {
      message: `deleted inventory`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
    'loan.created': {
      message: `created a loan`,
      icon: '🤝',
      color: 'text-purple-600 dark:text-purple-400'
    },
    'loan.updated': {
      message: `updated a loan`,
      icon: '✏️',
      color: 'text-blue-600 dark:text-blue-400'
    },
    'loan.returned': {
      message: `returned a loan`,
      icon: '↩️',
      color: 'text-green-600 dark:text-green-400'
    },
    'loan.deleted': {
      message: `deleted a loan`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
    'location.created': {
      message: `created location "${entityName}"`,
      icon: '📍',
      color: 'text-green-600 dark:text-green-400'
    },
    'location.updated': {
      message: `updated location "${entityName}"`,
      icon: '✏️',
      color: 'text-blue-600 dark:text-blue-400'
    },
    'location.deleted': {
      message: `deleted location "${entityName}"`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
    'container.created': {
      message: `created container "${entityName}"`,
      icon: '🗄️',
      color: 'text-green-600 dark:text-green-400'
    },
    'container.updated': {
      message: `updated container "${entityName}"`,
      icon: '✏️',
      color: 'text-blue-600 dark:text-blue-400'
    },
    'container.deleted': {
      message: `deleted container "${entityName}"`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
    'category.created': {
      message: `created category "${entityName}"`,
      icon: '🏷️',
      color: 'text-green-600 dark:text-green-400'
    },
    'category.updated': {
      message: `updated category "${entityName}"`,
      icon: '✏️',
      color: 'text-blue-600 dark:text-blue-400'
    },
    'category.deleted': {
      message: `deleted category "${entityName}"`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
    'borrower.created': {
      message: `added borrower "${entityName}"`,
      icon: '👤',
      color: 'text-green-600 dark:text-green-400'
    },
    'borrower.updated': {
      message: `updated borrower "${entityName}"`,
      icon: '✏️',
      color: 'text-blue-600 dark:text-blue-400'
    },
    'borrower.deleted': {
      message: `deleted borrower "${entityName}"`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
    'label.created': {
      message: `created label "${entityName}"`,
      icon: '🏷️',
      color: 'text-green-600 dark:text-green-400'
    },
    'label.updated': {
      message: `updated label "${entityName}"`,
      icon: '✏️',
      color: 'text-blue-600 dark:text-blue-400'
    },
    'label.deleted': {
      message: `deleted label "${entityName}"`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
    'company.created': {
      message: `added company "${entityName}"`,
      icon: '🏢',
      color: 'text-green-600 dark:text-green-400'
    },
    'company.updated': {
      message: `updated company "${entityName}"`,
      icon: '✏️',
      color: 'text-blue-600 dark:text-blue-400'
    },
    'company.deleted': {
      message: `deleted company "${entityName}"`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
    'favorite.created': {
      message: `favorited "${entityName}"`,
      icon: '⭐',
      color: 'text-yellow-600 dark:text-yellow-400'
    },
    'attachment.created': {
      message: `added attachment "${entityName}"`,
      icon: '📎',
      color: 'text-green-600 dark:text-green-400'
    },
    'attachment.deleted': {
      message: `removed attachment "${entityName}"`,
      icon: '🗑️',
      color: 'text-red-600 dark:text-red-400'
    },
  };

  const template = templates[event.type] || {
    message: `${action} ${event.entity_type}`,
    icon: '📢',
    color: 'text-foreground'
  };

  return {
    id: crypto.randomUUID(),
    type: event.type,
    userName,
    message: template.message,
    timestamp: new Date(event.timestamp),
    icon: template.icon,
    color: template.color,
  };
}
