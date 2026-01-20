"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";

export function OfflineIndicator() {
  const t = useTranslations("pwa.offline");
  const { isOffline, wasOffline } = useNetworkStatus();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Show "back online" message briefly after reconnecting
  if (wasOffline && !isOffline) {
    return (
      <div
        className={cn(
          "bg-green-600 text-white px-4 py-2",
          "animate-in fade-in slide-in-from-top duration-300"
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-center gap-2">
          <Wifi className="h-4 w-4" />
          <span className="text-sm font-medium">{t("backOnline")}</span>
        </div>
      </div>
    );
  }

  // Show offline banner when disconnected
  if (isOffline) {
    return (
      <div
        className={cn(
          "bg-destructive text-destructive-foreground px-4 py-2",
          "animate-in fade-in slide-in-from-top duration-300"
        )}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">{t("message")}</span>
        </div>
      </div>
    );
  }

  return null;
}
