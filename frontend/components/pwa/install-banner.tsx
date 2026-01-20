"use client";

import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/hooks/use-pwa-install";
import { IOSInstallInstructions } from "./ios-install-instructions";

const DISMISS_KEY = "pwa-install-banner-dismissed";
const DISMISS_DAYS = 7;

export function InstallBanner() {
  const t = useTranslations("pwa");
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(true);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const now = new Date();
      const daysSinceDismissal = Math.floor(
        (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceDismissal < DISMISS_DAYS) {
        setIsDismissed(true);
        return;
      }
    }
    setIsDismissed(false);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setIsDismissed(true);
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      const accepted = await promptInstall();
      if (accepted) {
        handleDismiss();
      }
    }
  };

  if (isInstalled || isDismissed || !isInstallable) {
    return null;
  }

  return (
    <>
      <div className="bg-primary text-primary-foreground px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{t("banner.title")}</p>
              <p className="text-xs text-primary-foreground/80 truncate hidden sm:block">
                {t("banner.description")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleInstallClick}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{t("banner.install")}</span>
              <span className="sm:hidden">{t("banner.installShort")}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDismiss}
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              aria-label={t("banner.dismiss")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <IOSInstallInstructions
        open={showIOSInstructions}
        onOpenChange={setShowIOSInstructions}
      />
    </>
  );
}
