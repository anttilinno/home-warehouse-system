import type { ReactNode } from "react";

const BADGE_VARIANTS = {
  neutral: "bg-bg-panel-2",
  ok: "bg-ok-bg",
  warn: "bg-warn-bg",
  danger: "bg-danger-bg",
  info: "bg-info-bg",
} as const;

export type RetroBadgeVariant = keyof typeof BADGE_VARIANTS;

export interface RetroBadgeProps {
  variant?: RetroBadgeVariant;
  className?: string;
  children: ReactNode;
}

// Pastel fill + 1px ink border + 2px radius — the only rounded element in
// the system. Ink text always (pastel fills never carry colored text).
export function RetroBadge({
  variant = "neutral",
  className = "",
  children,
}: RetroBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-[6px] rounded-chip border border-border-ink px-sp-2 py-px text-11 font-bold uppercase tracking-7 text-fg-ink ${BADGE_VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
