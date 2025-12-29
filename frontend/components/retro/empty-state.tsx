"use client";

import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { NES_BLUE } from "@/lib/nes-colors";
import { RetroButton } from "./button";
import { cn } from "@/lib/utils";

type IconName = keyof typeof LucideIcons;

interface RetroEmptyStateProps {
  icon: IconName;
  message: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: IconName;
  };
  className?: string;
}

export function RetroEmptyState({
  icon,
  message,
  description,
  action,
  className,
}: RetroEmptyStateProps) {
  return (
    <div className={cn("retro-card p-12 text-center", className)}>
      <div
        className="w-16 h-16 mx-auto mb-4 border-4 border-border flex items-center justify-center"
        style={{ backgroundColor: NES_BLUE }}
      >
        <Icon name={icon} className="w-8 h-8 text-white" />
      </div>
      <p className="retro-heading text-muted-foreground mb-2">{message}</p>
      {description && (
        <p className="retro-body text-muted-foreground mb-4">{description}</p>
      )}
      {action && (
        <RetroButton
          variant="primary"
          icon={action.icon}
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </RetroButton>
      )}
    </div>
  );
}
