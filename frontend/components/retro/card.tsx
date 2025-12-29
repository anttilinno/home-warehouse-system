"use client";

import { Icon } from "@/components/icons";
import type * as LucideIcons from "lucide-react";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";
import { cn } from "@/lib/utils";

type IconName = keyof typeof LucideIcons;

interface RetroCardProps {
  title?: string;
  icon?: IconName;
  headerAction?: React.ReactNode;
  headerBg?: "secondary" | "primary" | "muted" | "success" | "info" | "danger" | "warning";
  padding?: "sm" | "md" | "lg" | "none";
  className?: string;
  children: React.ReactNode;
}

const paddingStyles: Record<string, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  none: "",
};

const headerBgStyles: Record<string, { className: string; style?: React.CSSProperties }> = {
  secondary: { className: "bg-secondary" },
  primary: { className: "text-white", style: { backgroundColor: "var(--primary)" } },
  muted: { className: "bg-muted" },
  success: { className: "text-white", style: { backgroundColor: NES_GREEN } },
  info: { className: "text-white", style: { backgroundColor: NES_BLUE } },
  danger: { className: "text-white", style: { backgroundColor: NES_RED } },
  warning: { className: "text-black", style: { backgroundColor: NES_YELLOW } },
};

export function RetroCard({
  title,
  icon,
  headerAction,
  headerBg = "secondary",
  padding = "md",
  className,
  children,
}: RetroCardProps) {
  const hasHeader = title || icon || headerAction;
  const headerStyle = headerBgStyles[headerBg];

  return (
    <div className={cn("retro-card", className)}>
      {hasHeader && (
        <div
          className={cn(
            "border-b-4 border-border px-3 py-2 flex items-center justify-between",
            headerStyle.className
          )}
          style={headerStyle.style}
        >
          <div className="flex items-center gap-2">
            {icon && <Icon name={icon} className="w-4 h-4" />}
            {title && <h2 className="retro-heading">{title}</h2>}
          </div>
          {headerAction}
        </div>
      )}
      <div className={paddingStyles[padding]}>{children}</div>
    </div>
  );
}
