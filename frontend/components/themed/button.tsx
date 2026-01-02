"use client";

import * as React from "react";
import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

type IconName = keyof typeof LucideIcons;

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "info" | "muted" | "ghost";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconName;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const iconSize = size === "icon" || size === "icon-sm" ? "w-4 h-4" : size === "sm" || size === "xs" ? "w-3 h-3" : "w-4 h-4";

  return (
    <button
      className={cn(
        "themed-btn",
        `themed-btn--${variant}`,
        `themed-btn--${size}`,
        fullWidth && "themed-btn--full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Icon name="Loader2" className={cn(iconSize, "animate-spin")} />
      ) : (
        <>
          {icon && iconPosition === "left" && <Icon name={icon} className={iconSize} />}
          {children}
          {icon && iconPosition === "right" && <Icon name={icon} className={iconSize} />}
        </>
      )}
    </button>
  );
}
