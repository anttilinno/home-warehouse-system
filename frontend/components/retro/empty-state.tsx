"use client";

import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { NES_BLUE } from "@/lib/nes-colors";
import { RetroButton } from "./button";
import { cn } from "@/lib/utils";
import React from "react";

type IconName = keyof typeof LucideIcons;

interface RetroEmptyStateProps {
  icon: React.ReactNode | IconName;
  iconBgColor?: string;
  message: string;
  description?: string;
  action?: React.ReactNode | {
    label: string;
    onClick: () => void;
    icon?: IconName;
  };
  className?: string;
}

export function RetroEmptyState({
  icon,
  iconBgColor = NES_BLUE,
  message,
  description,
  action,
  className,
}: RetroEmptyStateProps) {
  // Determine if icon is a ReactNode or an IconName string
  const isIconName = typeof icon === "string";

  // Determine if action is a ReactNode or an action object
  const isActionObject = action && typeof action === "object" && "label" in action;

  return (
    <div className={cn("retro-card retro-card--shadow p-12 text-center", className)}>
      <div
        className="w-16 h-16 mx-auto mb-4 border-4 border-border flex items-center justify-center"
        style={{ backgroundColor: iconBgColor }}
      >
        {isIconName ? (
          <Icon name={icon as IconName} className="w-8 h-8 text-white" />
        ) : (
          icon
        )}
      </div>
      <p className="retro-body text-muted-foreground mb-2">{message}</p>
      {description && (
        <p className="retro-body text-muted-foreground mb-4">{description}</p>
      )}
      {action && (
        isActionObject ? (
          <RetroButton
            variant="primary"
            icon={(action as { icon?: IconName }).icon}
            onClick={(action as { onClick: () => void }).onClick}
            className="mt-4"
          >
            {(action as { label: string }).label}
          </RetroButton>
        ) : (
          <div className="mt-4">{action}</div>
        )
      )}
    </div>
  );
}
