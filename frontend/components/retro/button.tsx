"use client";

import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

type IconName = keyof typeof LucideIcons;

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "info" | "muted" | "ghost";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconName;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

export function RetroButton({
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
}: RetroButtonProps) {
  const variantClass = `retro-btn--${variant}`;
  const sizeClass = size !== "md" ? `retro-btn--${size}` : "";

  const baseClasses = cn(
    "retro-btn",
    variantClass,
    sizeClass,
    fullWidth && "w-full",
    className
  );

  const iconSize = size === "icon" ? "w-4 h-4" : size === "sm" || size === "xs" ? "w-3 h-3" : "w-4 h-4";

  return (
    <button
      className={baseClasses}
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
