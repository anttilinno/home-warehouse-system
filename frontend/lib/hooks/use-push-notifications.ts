"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";

interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

interface PushStatus {
  enabled: boolean;
  device_count: number;
  devices: Array<{
    id: string;
    user_agent: string | null;
    created_at: string;
  }>;
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | "default";
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  checkStatus: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "default">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if push notifications are supported
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check current subscription status
  const checkStatus = useCallback(async () => {
    if (!isSupported) return;

    try {
      const response = await apiClient.get<PushStatus>("/push/status");
      setIsSubscribed(response.enabled);
    } catch {
      // User might not be authenticated yet
      setIsSubscribed(false);
    }
  }, [isSupported]);

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError("Push notifications are not supported in this browser");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        setError("Notification permission denied");
        return false;
      }

      // Get the service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Get the VAPID public key from environment
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setError("Push notifications not configured");
        return false;
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Extract keys from the subscription
      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");

      if (!p256dh || !auth) {
        setError("Failed to get subscription keys");
        return false;
      }

      const keys: PushSubscriptionKeys = {
        p256dh: arrayBufferToBase64(p256dh),
        auth: arrayBufferToBase64(auth),
      };

      // Send subscription to backend
      await apiClient.post("/push/subscribe", {
        endpoint: subscription.endpoint,
        keys,
        user_agent: navigator.userAgent,
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to subscribe";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    setError(null);

    try {
      // Get the service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Get current subscription
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from backend
        await apiClient.post("/push/unsubscribe", {
          endpoint: subscription.endpoint,
        });
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to unsubscribe";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    checkStatus,
  };
}
