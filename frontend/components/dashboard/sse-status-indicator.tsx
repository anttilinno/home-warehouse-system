"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useSSE } from "@/lib/hooks/use-sse";
import { cn } from "@/lib/utils";

interface SSEStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function SSEStatusIndicator({ className, showLabel = true }: SSEStatusIndicatorProps) {
  const { isConnected } = useSSE();

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3 text-green-500" aria-label="Connected" />
          {showLabel && <span>Live</span>}
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-yellow-500" aria-label="Disconnected" />
          {showLabel && <span>Reconnecting...</span>}
        </>
      )}
    </div>
  );
}
