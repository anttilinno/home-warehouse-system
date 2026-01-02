'use client';

import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { Button } from '@/components/themed';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface InstallPromptProps {
  className?: string;
}

export function InstallPrompt({ className }: InstallPromptProps) {
  const { isInstallable, install, dismiss } = useInstallPrompt();

  if (!isInstallable) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80',
        'bg-card border rounded-lg shadow-lg p-4 z-50',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
          <Icon name="Download" className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm">Install HMS</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Install the app for offline access and a better experience.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={install}>
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <Icon name="X" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
