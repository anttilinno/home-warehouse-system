"use client";

import { Share, Plus, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IOSInstallInstructionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IOSInstallInstructions({
  open,
  onOpenChange,
}: IOSInstallInstructionsProps) {
  const t = useTranslations("pwa");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t("ios.title")}
          </DialogTitle>
          <DialogDescription>{t("ios.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              1
            </div>
            <div className="space-y-1">
              <p className="font-medium">{t("ios.step1.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("ios.step1.description")}
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
                <Share className="h-4 w-4" />
                <span>{t("ios.step1.button")}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              2
            </div>
            <div className="space-y-1">
              <p className="font-medium">{t("ios.step2.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("ios.step2.description")}
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
                <Plus className="h-4 w-4" />
                <span>{t("ios.step2.button")}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              3
            </div>
            <div className="space-y-1">
              <p className="font-medium">{t("ios.step3.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("ios.step3.description")}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
