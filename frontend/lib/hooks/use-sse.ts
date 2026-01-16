"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/contexts/auth-context";

export interface SSEEvent {
  type: string;
  entity_id?: string;
  entity_type: string;
  workspace_id: string;
  user_id: string;
  timestamp: string;
  data?: Record<string, any>;
}

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
   * Automatically reconnect on disconnect
   */
  autoReconnect?: boolean;

  /**
   * Reconnect delay in milliseconds
   */
  reconnectDelay?: number;
}

/**
 * Hook to subscribe to workspace SSE events
 */
export function useSSE(options: UseSSEOptions = {}) {
  const { currentWorkspace } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    onEvent,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  useEffect(() => {
    if (!currentWorkspace) {
      return;
    }

    const connect = () => {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create SSE connection
      const url = `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${currentWorkspace.id}/sse`;
      const eventSource = new EventSource(url, {
        withCredentials: true, // Include cookies for auth
      });

      eventSourceRef.current = eventSource;

      // Handle connection open
      eventSource.addEventListener("open", () => {
        setIsConnected(true);
        setError(null);
        onConnect?.();
      });

      // Handle connection event (initial)
      eventSource.addEventListener("connected", (e) => {
        const data = JSON.parse(e.data);
        console.log("[SSE] Connected with client ID:", data.client_id);
      });

      // Handle generic events
      eventSource.addEventListener("message", (e) => {
        try {
          const event: SSEEvent = JSON.parse(e.data);
          onEvent?.(event);
        } catch (err) {
          console.error("[SSE] Failed to parse event:", err);
        }
      });

      // Handle specific event types (dynamic)
      const eventTypes = [
        "item.created",
        "item.updated",
        "item.deleted",
        "inventory.created",
        "inventory.updated",
        "inventory.deleted",
        "loan.created",
        "loan.updated",
        "loan.returned",
        "loan.deleted",
        "location.created",
        "location.updated",
        "location.deleted",
        "container.created",
        "container.updated",
        "container.deleted",
        "category.created",
        "category.updated",
        "category.deleted",
        "borrower.created",
        "borrower.updated",
        "borrower.deleted",
        "label.created",
        "label.updated",
        "label.deleted",
        "company.created",
        "company.updated",
        "company.deleted",
        "favorite.created",
        "attachment.created",
        "attachment.updated",
        "attachment.deleted",
      ];

      eventTypes.forEach((type) => {
        eventSource.addEventListener(type, (e) => {
          try {
            const event: SSEEvent = JSON.parse((e as MessageEvent).data);
            onEvent?.(event);
          } catch (err) {
            console.error(`[SSE] Failed to parse ${type} event:`, err);
          }
        });
      });

      // Handle errors
      eventSource.addEventListener("error", (e) => {
        console.error("[SSE] Connection error:", e);
        setIsConnected(false);
        setError("Connection lost");
        onError?.(e);
        onDisconnect?.();

        // Auto-reconnect
        if (autoReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[SSE] Attempting to reconnect...");
            connect();
          }, reconnectDelay);
        }
      });
    };

    connect();

    // Cleanup on unmount or workspace change
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setIsConnected(false);
    };
  }, [
    currentWorkspace?.id,
    autoReconnect,
    reconnectDelay,
    onEvent,
    onConnect,
    onDisconnect,
    onError,
  ]);

  return {
    isConnected,
    error,
  };
}
