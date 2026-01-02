"use client";

import * as React from "react";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

type IconName = keyof typeof LucideIcons;

export interface CardProps {
  title?: string;
  icon?: IconName;
  headerAction?: React.ReactNode;
  headerBg?: "secondary" | "primary" | "muted" | "success" | "info" | "danger" | "warning";
  padding?: "sm" | "md" | "lg" | "none";
  shadow?: boolean;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

const paddingStyles: Record<string, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  none: "",
};

const headerBgStyles: Record<string, string> = {
  secondary: "themed-card__header--secondary",
  primary: "themed-card__header--primary",
  muted: "themed-card__header--muted",
  success: "themed-card__header--success",
  info: "themed-card__header--info",
  danger: "themed-card__header--danger",
  warning: "themed-card__header--warning",
};

export function Card({
  title,
  icon,
  headerAction,
  headerBg = "secondary",
  padding = "md",
  shadow = true,
  interactive = false,
  className,
  children,
}: CardProps) {
  const hasHeader = title || icon || headerAction;

  return (
    <div
      className={cn(
        "themed-card",
        !shadow && "themed-card--no-shadow",
        interactive && "themed-card--interactive",
        className
      )}
    >
      {hasHeader && (
        <div className={cn("themed-card__header", headerBgStyles[headerBg])}>
          <div className="flex items-center gap-2">
            {icon && <Icon name={icon} className="w-4 h-4" />}
            {title && <h2 className="themed-card__title">{title}</h2>}
          </div>
          {headerAction}
        </div>
      )}
      <div className={cn("themed-card__body", padding === "none" && "themed-card__body--flush", paddingStyles[padding])}>
        {children}
      </div>
    </div>
  );
}
