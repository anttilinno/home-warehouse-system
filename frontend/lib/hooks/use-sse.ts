"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSSEConnection, useSSESubscription, type SSEEvent } from "@/lib/contexts/sse-context";

// Re-export SSEEvent type for backwards compatibility
export type { SSEEvent } from "@/lib/contexts/sse-context";

export interface UseSSEOptions {
  /**
   * Callback when an event is received
   */
  onEvent?: (event: SSEEvent) => void;

  /**
   * Callback when connected
   */
  onConnect?: () => void;

  /**
   * Callback when disconnected
   */
  onDisconnect?: () => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: Event) => void;

  /**
   * @deprecated - autoReconnect is now handled by SSEProvider
   */
  autoReconnect?: boolean;

  /**
   * @deprecated - reconnectDelay is now handled by SSEProvider
   */
  reconnectDelay?: number;
}

/**
 * Hook to subscribe to workspace SSE events.
 * Uses the shared SSEProvider connection instead of creating individual connections.
 */
export function useSSE(options: UseSSEOptions = {}) {
  const { isConnected, error, reconnect } = useSSEConnection();
  const prevConnectedRef = useRef(isConnected);

  // Store callbacks in refs to avoid re-running effects
  const onEventRef = useRef(options.onEvent);
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);

  // Update refs when callbacks change
  useEffect(() => {
    onEventRef.current = options.onEvent;
    onConnectRef.current = options.onConnect;
    onDisconnectRef.current = options.onDisconnect;
  });

  // Handle connect/disconnect callbacks
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current) {
      onConnectRef.current?.();
    } else if (!isConnected && prevConnectedRef.current) {
      onDisconnectRef.current?.();
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected]);

  // Memoize the event handler to prevent re-subscriptions
  const handleEvent = useCallback((event: SSEEvent) => {
    onEventRef.current?.(event);
  }, []);

  // Subscribe to events
  useSSESubscription(handleEvent);

  return {
    isConnected,
    error,
    reconnect,
  };
}
