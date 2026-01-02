"use client";

import * as React from "react";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type IconName = keyof typeof LucideIcons;

export interface EmptyStateProps {
  icon: React.ReactNode | IconName;
  message: string;
  description?: string;
  action?: React.ReactNode | {
    label: string;
    onClick: () => void;
    icon?: IconName;
  };
  className?: string;
}

export function EmptyState({
  icon,
  message,
  description,
  action,
  className,
}: EmptyStateProps) {
  // Determine if icon is a ReactNode or an IconName string
  const isIconName = typeof icon === "string";

  // Determine if action is a ReactNode or an action object
  const isActionObject = action && typeof action === "object" && "label" in action;

  return (
    <div className={cn("themed-empty-state", className)}>
      <div className="themed-empty-state__icon-wrapper">
        {isIconName ? (
          <Icon name={icon as IconName} className="themed-empty-state__icon" />
        ) : (
          icon
        )}
      </div>
      <p className="themed-empty-state__title">{message}</p>
      {description && (
        <p className="themed-empty-state__text">{description}</p>
      )}
      {action && (
        <div className="themed-empty-state__action">
          {isActionObject ? (
            <Button
              variant="primary"
              icon={(action as { icon?: IconName }).icon}
              onClick={(action as { onClick: () => void }).onClick}
            >
              {(action as { label: string }).label}
            </Button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}
