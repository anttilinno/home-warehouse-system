"use client";

import { useState, useEffect } from "react";
import { usePwaInstall } from "@/lib/hooks/use-pwa-install";
import { Button } from "@/components/ui/button";
import { X, Download, Share } from "lucide-react";

const DISMISS_KEY = "pwa-install-dismissed";

/**
 * PwaInstallPrompt displays a dismissible banner prompting users to install the PWA.
 *
 * Features:
 * - Only shows when app is installable (not already installed as PWA)
 * - Shows iOS-specific instructions for Safari users
 * - Dismissible with "Don't show again" option (stored in localStorage)
 * - Fixed position at bottom of viewport
 *
 * Note: The app also has InstallBanner in @/components/pwa which serves a similar
 * purpose with a different design (top banner style). Use whichever fits your needs.
 */
export function PwaInstallPrompt() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(true); // Start true to prevent flash

  useEffect(() => {
    // Check localStorage on mount
    const dismissed = localStorage.getItem(DISMISS_KEY);
    setIsDismissed(dismissed === "true");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setIsDismissed(true);
  };

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setIsDismissed(true);
    }
  };

  // Don't show if: already installed, not installable, or dismissed
  if (isInstalled || !isInstallable || isDismissed) {
    return null;
  }

  // iOS Safari - show manual instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm sm:rounded-lg sm:border">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="rounded-full bg-primary/10 p-2">
            <Share className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Install Home Warehouse</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap <Share className="inline h-4 w-4" /> then &quot;Add to Home Screen&quot; for the best offline experience.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Chrome/Edge - show install button
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm sm:rounded-lg sm:border">
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <div className="rounded-full bg-primary/10 p-2">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium">Install Home Warehouse</p>
          <p className="text-sm text-muted-foreground">
            Get offline access and faster loading.
          </p>
        </div>
        <Button size="sm" onClick={handleInstall}>
          Install
        </Button>
      </div>
    </div>
  );
}
