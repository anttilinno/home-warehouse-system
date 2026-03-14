"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getAll } from "@/lib/db/offline-db";
import type { Category } from "@/lib/api/categories";
import type { Location } from "@/lib/types/locations";

interface BatchSettings {
  categoryId: string | null;
  locationId: string | null;
}

interface BatchCaptureContextValue {
  settings: BatchSettings;
  setCategoryId: (id: string | null) => void;
  setLocationId: (id: string | null) => void;
  resetSettings: () => void;
  captureCount: number;
  incrementCaptureCount: () => void;
  /** Resolved display name for the current category (null if none set or not found in cache) */
  categoryName: string | null;
  /** Resolved display name for the current location (null if none set or not found in cache) */
  locationName: string | null;
  /** Object URLs for session thumbnails (one per saved item, from first photo blob) */
  sessionThumbnails: string[];
  addSessionThumbnail: (url: string) => void;
  clearSessionThumbnails: () => void;
}

const DEFAULT_SETTINGS: BatchSettings = {
  categoryId: null,
  locationId: null,
};

const SESSION_STORAGE_KEY = "quickCaptureBatch";

const BatchCaptureContext = createContext<BatchCaptureContextValue | undefined>(
  undefined
);

export function BatchCaptureProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BatchSettings>(() => {
    if (typeof sessionStorage === "undefined") return DEFAULT_SETTINGS;
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [captureCount, setCaptureCount] = useState(0);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [sessionThumbnails, setSessionThumbnails] = useState<string[]>([]);

  // Persist settings to sessionStorage on every change
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Revoke all thumbnail object URLs on provider unmount
  useEffect(() => {
    return () => {
      setSessionThumbnails(prev => {
        prev.forEach(url => URL.revokeObjectURL(url));
        return [];
      });
    };
  }, []);

  // Resolve category display name from IndexedDB cache
  useEffect(() => {
    if (!settings.categoryId) {
      setCategoryName(null);
      return;
    }
    getAll<Category>("categories").then((cats) => {
      const found = cats.find((c) => c.id === settings.categoryId);
      setCategoryName(found?.name ?? null);
    });
  }, [settings.categoryId]);

  // Resolve location display name from IndexedDB cache
  useEffect(() => {
    if (!settings.locationId) {
      setLocationName(null);
      return;
    }
    getAll<Location>("locations").then((locs) => {
      const found = locs.find((l) => l.id === settings.locationId);
      setLocationName(found?.name ?? null);
    });
  }, [settings.locationId]);

  const setCategoryId = useCallback((id: string | null) => {
    setSettings((prev) => ({ ...prev, categoryId: id }));
  }, []);

  const setLocationId = useCallback((id: string | null) => {
    setSettings((prev) => ({ ...prev, locationId: id }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setCaptureCount(0);
    setSessionThumbnails(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return [];
    });
  }, []);

  const addSessionThumbnail = useCallback((url: string) => {
    setSessionThumbnails(prev => [...prev, url]);
  }, []);

  const clearSessionThumbnails = useCallback(() => {
    setSessionThumbnails(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return [];
    });
  }, []);

  const incrementCaptureCount = useCallback(() => {
    setCaptureCount((prev) => prev + 1);
  }, []);

  const value: BatchCaptureContextValue = {
    settings,
    setCategoryId,
    setLocationId,
    resetSettings,
    captureCount,
    incrementCaptureCount,
    categoryName,
    locationName,
    sessionThumbnails,
    addSessionThumbnail,
    clearSessionThumbnails,
  };

  return (
    <BatchCaptureContext.Provider value={value}>
      {children}
    </BatchCaptureContext.Provider>
  );
}

export function useBatchCapture(): BatchCaptureContextValue {
  const context = useContext(BatchCaptureContext);
  if (context === undefined) {
    throw new Error(
      "useBatchCapture must be used within a BatchCaptureProvider"
    );
  }
  return context;
}
