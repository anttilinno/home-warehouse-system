"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useSSE } from "@/lib/hooks/use-sse";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SSEStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function SSEStatusIndicator({ className, showLabel = true }: SSEStatusIndicatorProps) {
  const { isConnected, reconnect } = useSSE();

  if (isConnected) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Wifi className="h-3 w-3 text-green-500" aria-label="Connected" />
        {showLabel && <span>Live</span>}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={reconnect}
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
            className
          )}
        >
          <WifiOff className="h-3 w-3 text-yellow-500" aria-label="Disconnected" />
          {showLabel && <span>Reconnecting...</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Click to reconnect</p>
      </TooltipContent>
    </Tooltip>
  );
}
