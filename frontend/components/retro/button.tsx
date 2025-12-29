"use client";

import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { NES_GREEN, NES_BLUE, NES_RED } from "@/lib/nes-colors";
import { cn } from "@/lib/utils";

type IconName = keyof typeof LucideIcons;

interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "success" | "danger" | "muted" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: IconName;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const variantStyles: Record<string, { bg: string; text: string }> = {
  primary: { bg: NES_BLUE, text: "text-white" },
  success: { bg: NES_GREEN, text: "text-white" },
  danger: { bg: NES_RED, text: "text-white" },
  muted: { bg: "transparent", text: "text-foreground" },
  ghost: { bg: "transparent", text: "text-foreground" },
};

const sizeStyles: Record<string, string> = {
  sm: "px-2 py-1 text-xs",
  md: "px-4 py-2 retro-small",
  lg: "px-6 py-3 text-xs",
  icon: "w-8 h-8 p-0",
};

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
  style,
  ...props
}: RetroButtonProps) {
  const { bg, text } = variantStyles[variant];
  const isGhostOrMuted = variant === "ghost" || variant === "muted";

  const baseClasses = cn(
    "inline-flex items-center justify-center gap-2",
    "border-4 border-border",
    "font-bold uppercase retro-heading",
    "retro-shadow retro-hover",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
    text,
    sizeStyles[size],
    fullWidth && "w-full",
    isGhostOrMuted && "bg-card hover:bg-muted",
    className
  );

  const iconSize = size === "icon" ? "w-4 h-4" : size === "sm" ? "w-3 h-3" : "w-4 h-4";

  return (
    <button
      className={baseClasses}
      disabled={disabled || loading}
      style={{
        backgroundColor: isGhostOrMuted ? undefined : bg,
        ...style,
      }}
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
