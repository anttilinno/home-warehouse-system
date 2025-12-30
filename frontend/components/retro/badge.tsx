"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

/* ==========================================================================
   RetroBadge Components - Badges, tags, and status indicators

   Usage:
   <RetroBadge variant="success">Active</RetroBadge>
   <RetroBadge variant="warning" size="sm">Warning</RetroBadge>

   <RetroTag onRemove={() => handleRemove()}>Removable</RetroTag>

   <RetroStatus status="online">Active</RetroStatus>

   <RetroConditionBadge condition="excellent" />
   <RetroLoanStatusBadge status="active" />

   <RetroCount count={5} />

   <RetroChip selected={isSelected} onClick={() => toggle()}>Filter</RetroChip>
   ========================================================================== */

type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "outline"
  | "outline-primary"
  | "outline-success";

type BadgeSize = "sm" | "md" | "lg";

// Base Badge
interface RetroBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  interactive?: boolean;
}

export function RetroBadge({
  variant = "default",
  size = "md",
  interactive,
  className,
  children,
  ...props
}: RetroBadgeProps) {
  const variantClass = variant !== "default" ? `retro-badge--${variant}` : "retro-badge--default";
  const sizeClass = size !== "md" ? `retro-badge--${size}` : "";

  return (
    <span
      className={cn(
        "retro-badge-component",
        variantClass,
        sizeClass,
        interactive && "retro-badge--interactive",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// Tag (removable badge)
interface RetroTagProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  children: React.ReactNode;
  onRemove?: () => void;
  variant?: BadgeVariant;
}

export function RetroTag({
  children,
  onRemove,
  variant = "default",
  className,
  ...props
}: RetroTagProps) {
  const variantClass = variant !== "default" ? `retro-badge--${variant}` : "retro-badge--default";

  return (
    <span className={cn("retro-tag", variantClass, className)} {...props}>
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="retro-tag__remove"
          aria-label="Remove"
        >
          <Icon name="X" className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// Status indicator
type StatusType = "online" | "offline" | "busy" | "error";

interface RetroStatusProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  children?: React.ReactNode;
}

export function RetroStatus({
  status,
  children,
  className,
  ...props
}: RetroStatusProps) {
  return (
    <span
      className={cn("retro-status", `retro-status--${status}`, className)}
      {...props}
    >
      <span className="retro-status__dot retro-status__dot--active" />
      {children && <span className="retro-small">{children}</span>}
    </span>
  );
}

// Label with color indicator
interface RetroLabelTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  color: string;
  children: React.ReactNode;
}

export function RetroLabelTag({
  color,
  children,
  className,
  ...props
}: RetroLabelTagProps) {
  return (
    <span className={cn("retro-label-tag", className)} {...props}>
      <span
        className="retro-label-tag__color"
        style={{ backgroundColor: color }}
      />
      <span className="retro-label-tag__text">{children}</span>
    </span>
  );
}

// Count badge (notification-style)
interface RetroCountProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number;
  max?: number;
  size?: "sm" | "md" | "lg";
}

export function RetroCount({
  count,
  max = 99,
  size = "md",
  className,
  ...props
}: RetroCountProps) {
  const displayCount = count > max ? `${max}+` : count;
  const sizeClass = size !== "md" ? `retro-count--${size}` : "";

  return (
    <span className={cn("retro-count", sizeClass, className)} {...props}>
      {displayCount}
    </span>
  );
}

// Condition badge
type ConditionType = "new" | "excellent" | "good" | "fair" | "poor" | "damaged" | "for_repair";

interface RetroConditionBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  condition: ConditionType | string;
  showLabel?: boolean;
}

const conditionLabels: Record<string, string> = {
  new: "New",
  NEW: "New",
  excellent: "Excellent",
  EXCELLENT: "Excellent",
  good: "Good",
  GOOD: "Good",
  fair: "Fair",
  FAIR: "Fair",
  poor: "Poor",
  POOR: "Poor",
  damaged: "Damaged",
  DAMAGED: "Damaged",
  for_repair: "For Repair",
  FOR_REPAIR: "For Repair",
};

const conditionClasses: Record<string, string> = {
  new: "retro-condition--new",
  NEW: "retro-condition--new",
  excellent: "retro-condition--excellent",
  EXCELLENT: "retro-condition--excellent",
  good: "retro-condition--good",
  GOOD: "retro-condition--good",
  fair: "retro-condition--fair",
  FAIR: "retro-condition--fair",
  poor: "retro-condition--poor",
  POOR: "retro-condition--poor",
  damaged: "retro-condition--poor",
  DAMAGED: "retro-condition--poor",
  for_repair: "retro-condition--fair",
  FOR_REPAIR: "retro-condition--fair",
};

export function RetroConditionBadge({
  condition,
  showLabel = true,
  className,
  ...props
}: RetroConditionBadgeProps) {
  const normalizedCondition = condition.toLowerCase();
  const label = conditionLabels[condition] || condition;
  const conditionClass = conditionClasses[condition] || "retro-condition--good";

  return (
    <span className={cn("retro-condition", conditionClass, className)} {...props}>
      {showLabel ? label : null}
    </span>
  );
}

// Loan status badge
type LoanStatusType = "active" | "overdue" | "due_soon" | "returned";

interface RetroLoanStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: LoanStatusType | string;
}

const loanStatusLabels: Record<string, string> = {
  active: "Active",
  ACTIVE: "Active",
  overdue: "Overdue",
  OVERDUE: "Overdue",
  due_soon: "Due Soon",
  DUE_SOON: "Due Soon",
  returned: "Returned",
  RETURNED: "Returned",
};

const loanStatusClasses: Record<string, string> = {
  active: "retro-loan-status--active",
  ACTIVE: "retro-loan-status--active",
  overdue: "retro-loan-status--overdue",
  OVERDUE: "retro-loan-status--overdue",
  due_soon: "retro-loan-status--due-soon",
  DUE_SOON: "retro-loan-status--due-soon",
  returned: "retro-loan-status--returned",
  RETURNED: "retro-loan-status--returned",
};

export function RetroLoanStatusBadge({
  status,
  className,
  ...props
}: RetroLoanStatusBadgeProps) {
  const label = loanStatusLabels[status] || status;
  const statusClass = loanStatusClasses[status] || "retro-loan-status--active";

  return (
    <span className={cn("retro-loan-status", statusClass, className)} {...props}>
      {label}
    </span>
  );
}

// Chip (filter-style badge)
interface RetroChipProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  selected?: boolean;
  icon?: React.ReactNode;
}

export function RetroChip({
  children,
  selected,
  icon,
  className,
  ...props
}: RetroChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "retro-chip",
        selected && "retro-chip--selected",
        className
      )}
      {...props}
    >
      {icon && <span className="retro-chip__icon">{icon}</span>}
      {children}
    </button>
  );
}
