"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import { authApi } from "@/lib/api/auth";
import { apiClient } from "@/lib/api/client";

export interface SSEEvent {
  type: string;
  entity_id?: string;
  entity_type: string;
  workspace_id: string;
  user_id: string;
  user_display_name?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

type SSEEventHandler = (event: SSEEvent) => void;

interface SSEContextValue {
  isConnected: boolean;
  error: string | null;
  subscribe: (handler: SSEEventHandler) => () => void;
  reconnect: () => void;
}

const SSEContext = createContext<SSEContextValue | undefined>(undefined);

interface SSEProviderProps {
  children: ReactNode;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

/**
 * SSE Provider that maintains a single connection and distributes events to subscribers
 */
export function SSEProvider({
  children,
  autoReconnect = true,
  reconnectDelay = 2000,
  maxReconnectAttempts = 10,
}: SSEProviderProps) {
  const { currentWorkspace, isAuthenticated, isLoading, logout } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribersRef = useRef<Set<SSEEventHandler>>(new Set());
  const hasConnectedOnceRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);
  const connectFnRef = useRef<(() => void) | null>(null);

  // Broadcast event to all subscribers
  const broadcastEvent = useCallback((event: SSEEvent) => {
    subscribersRef.current.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error("[SSE] Subscriber error:", err);
      }
    });
  }, []);

  // Subscribe to SSE events
  const subscribe = useCallback((handler: SSEEventHandler) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  // Manual reconnect function (resets attempt counter)
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (connectFnRef.current) {
      connectFnRef.current();
    }
  }, []);

  useEffect(() => {
    // Don't connect while auth is loading or if not authenticated
    if (isLoading || !isAuthenticated || !currentWorkspace) {
      return;
    }

    // Reset reconnect attempts when dependencies change (new workspace, re-authenticated)
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;

    const connect = () => {
      // Prevent concurrent reconnection attempts
      if (isReconnectingRef.current) {
        return;
      }

      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Create SSE connection with credentials (cookies)
      // Also include token as query param since EventSource can't send Authorization header
      // and cookies may be expired while localStorage token is still valid
      let url = `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${currentWorkspace.id}/sse`;
      const token = apiClient.getToken();
      if (token) {
        url += `?token=${encodeURIComponent(token)}`;
      }
      const eventSource = new EventSource(url, {
        withCredentials: true,
      });

      eventSourceRef.current = eventSource;

      // Handle connection open
      eventSource.addEventListener("open", () => {
        hasConnectedOnceRef.current = true;
        reconnectAttemptsRef.current = 0;
        isReconnectingRef.current = false;
        setIsConnected(true);
        setError(null);
        console.log("[SSE] Connection established");
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
          broadcastEvent(event);
        } catch (err) {
          console.error("[SSE] Failed to parse event:", err);
        }
      });

      // Handle specific event types
      const eventTypes = [
        "item.created",
        "item.updated",
        "item.deleted",
        "itemphoto.created",
        "itemphoto.updated",
        "itemphoto.deleted",
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
        "pendingchange.created",
        "pendingchange.approved",
        "pendingchange.rejected",
        "photo.thumbnail_ready",
        "photo.thumbnail_failed",
      ];

      eventTypes.forEach((type) => {
        eventSource.addEventListener(type, (e) => {
          try {
            const event: SSEEvent = JSON.parse((e as MessageEvent).data);
            broadcastEvent(event);
          } catch (err) {
            console.error(`[SSE] Failed to parse ${type} event:`, err);
          }
        });
      });

      // Handle errors
      eventSource.addEventListener("error", async () => {
        const wasConnected = eventSourceRef.current?.readyState === EventSource.OPEN;

        setIsConnected(false);
        setError("Connection lost");

        // Close the errored connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Don't start another reconnect if one is already in progress
        if (isReconnectingRef.current) {
          return;
        }

        // Check if we've exceeded max attempts
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.warn("[SSE] Max reconnect attempts reached. Use reconnect() to retry.");
          setError("Connection failed. Click to retry.");
          return;
        }

        if (!autoReconnect) {
          return;
        }

        isReconnectingRef.current = true;
        reconnectAttemptsRef.current += 1;

        // Cap the backoff at 30 seconds
        const backoffDelay = Math.min(
          reconnectDelay * Math.pow(1.5, reconnectAttemptsRef.current - 1),
          30000
        );

        // Before reconnecting, verify auth is still valid
        try {
          await authApi.getMe();
        } catch {
          // Auth failed - likely 401, trigger logout
          console.warn("[SSE] Auth check failed during reconnect, logging out");
          isReconnectingRef.current = false;
          logout();
          return;
        }

        if (hasConnectedOnceRef.current || wasConnected) {
          console.log(`[SSE] Reconnecting in ${Math.round(backoffDelay/1000)}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          isReconnectingRef.current = false;
          connect();
        }, backoffDelay);
      });
    };

    // Store connect function for manual reconnect
    connectFnRef.current = connect;
    connect();

    // Cleanup on unmount or workspace change
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      isReconnectingRef.current = false;
      setIsConnected(false);
    };
  }, [currentWorkspace?.id, isAuthenticated, isLoading, autoReconnect, reconnectDelay, maxReconnectAttempts, broadcastEvent, logout]);

  // Reconnect when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isConnected && isAuthenticated && currentWorkspace) {
        console.log("[SSE] Tab became visible, attempting reconnect...");
        reconnect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isConnected, isAuthenticated, currentWorkspace, reconnect]);

  // Reconnect when coming back online
  useEffect(() => {
    const handleOnline = () => {
      if (!isConnected && isAuthenticated && currentWorkspace) {
        console.log("[SSE] Network came online, attempting reconnect...");
        reconnect();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [isConnected, isAuthenticated, currentWorkspace, reconnect]);

  const value: SSEContextValue = {
    isConnected,
    error,
    subscribe,
    reconnect,
  };

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>;
}

/**
 * Hook to access SSE connection status and control
 */
export function useSSEConnection() {
  const context = useContext(SSEContext);
  if (context === undefined) {
    throw new Error("useSSEConnection must be used within an SSEProvider");
  }
  return {
    isConnected: context.isConnected,
    error: context.error,
    reconnect: context.reconnect,
  };
}

/**
 * Hook to subscribe to SSE events
 */
export function useSSESubscription(onEvent: SSEEventHandler) {
  const context = useContext(SSEContext);
  if (context === undefined) {
    throw new Error("useSSESubscription must be used within an SSEProvider");
  }

  useEffect(() => {
    return context.subscribe(onEvent);
  }, [context, onEvent]);
}
