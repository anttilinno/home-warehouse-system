"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function OfflineIndicator() {
  const { isOffline } = useNetworkStatus();
  const [mounted, setMounted] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Trigger pulse animation when transitioning to offline
  useEffect(() => {
    if (isOffline && mounted) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, mounted]);

  if (!mounted || !isOffline) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="relative flex items-center justify-center"
          data-testid="offline-indicator"
          role="status"
          aria-label="You are offline"
        >
          {showPulse && (
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-75" />
          )}
          <CloudOff
            className={cn("h-4 w-4 text-amber-500", showPulse && "animate-pulse")}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>You are offline</TooltipContent>
    </Tooltip>
  );
}
