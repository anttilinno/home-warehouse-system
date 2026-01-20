"use client";

import { useState } from "react";
import { Download, Check, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/hooks/use-pwa-install";
import { IOSInstallInstructions } from "./ios-install-instructions";

interface InstallButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function InstallButton({
  variant = "outline",
  size = "default",
  showIcon = true,
  className,
}: InstallButtonProps) {
  const t = useTranslations("pwa");
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePwaInstall();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      await promptInstall();
    }
  };

  if (isInstalled) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        {showIcon && <Check className="mr-2 h-4 w-4" />}
        {t("button.installed")}
      </Button>
    );
  }

  if (!isInstallable) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
      >
        {showIcon && (isIOS ? <Smartphone className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />)}
        {t("button.install")}
      </Button>

      <IOSInstallInstructions
        open={showIOSInstructions}
        onOpenChange={setShowIOSInstructions}
      />
    </>
  );
}
