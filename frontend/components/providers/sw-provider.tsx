"use client";

import { useEffect } from "react";

/**
 * Service Worker Registration Provider
 * Registers the PWA service worker on mount
 */
export function ServiceWorkerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration);

          // Check for updates periodically
          setInterval(
            () => {
              registration.update();
            },
            60 * 60 * 1000
          ); // Check every hour
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  return <>{children}</>;
}
