"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

/* ==========================================================================
   Unified Badge Components - Pure CSS theming
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
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  interactive?: boolean;
}

export function Badge({
  variant = "default",
  size = "md",
  interactive,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "themed-badge",
        `themed-badge--${variant}`,
        size !== "md" && `themed-badge--${size}`,
        interactive && "themed-badge--interactive",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// Tag (removable badge)
export interface TagProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  children: React.ReactNode;
  onRemove?: () => void;
  variant?: BadgeVariant;
}

export function Tag({
  children,
  onRemove,
  variant = "default",
  className,
  ...props
}: TagProps) {
  return (
    <span
      className={cn("themed-tag", `themed-tag--${variant}`, className)}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="themed-tag__remove"
          aria-label="Remove"
        >
          <Icon name="X" className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// Status indicator
type StatusType = "online" | "offline" | "busy" | "error" | "success" | "danger" | "warning" | "info" | "muted";

export interface StatusProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  children?: React.ReactNode;
}

export function Status({
  status,
  children,
  className,
  ...props
}: StatusProps) {
  return (
    <span className={cn("themed-status", `themed-status--${status}`, className)} {...props}>
      <span className="themed-status__dot" />
      {children && <span>{children}</span>}
    </span>
  );
}

// Label with color indicator
export interface LabelTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  color: string;
  children: React.ReactNode;
}

export function LabelTag({
  color,
  children,
  className,
  ...props
}: LabelTagProps) {
  return (
    <span className={cn("themed-label-tag", className)} {...props}>
      <span className="themed-label-tag__dot" style={{ backgroundColor: color }} />
      <span>{children}</span>
    </span>
  );
}

// Count badge (notification-style)
export interface CountProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "primary";
}

export function Count({
  count,
  max = 99,
  size = "md",
  variant = "default",
  className,
  ...props
}: CountProps) {
  const displayCount = count > max ? `${max}+` : count;

  return (
    <span
      className={cn(
        "themed-count",
        size !== "md" && `themed-count--${size}`,
        variant === "primary" && "themed-count--primary",
        className
      )}
      {...props}
    >
      {displayCount}
    </span>
  );
}

// Condition badge
type ConditionType = "new" | "excellent" | "good" | "fair" | "poor" | "damaged" | "for_repair";

export interface ConditionBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  condition: ConditionType | string;
  showLabel?: boolean;
}

const conditionLabels: Record<string, string> = {
  new: "New", NEW: "New",
  excellent: "Excellent", EXCELLENT: "Excellent",
  good: "Good", GOOD: "Good",
  fair: "Fair", FAIR: "Fair",
  poor: "Poor", POOR: "Poor",
  damaged: "Damaged", DAMAGED: "Damaged",
  for_repair: "For Repair", FOR_REPAIR: "For Repair",
};

export function ConditionBadge({
  condition,
  showLabel = true,
  className,
  ...props
}: ConditionBadgeProps) {
  const label = conditionLabels[condition] || condition;
  const normalizedCondition = condition.toLowerCase().replace("_", "-");

  return (
    <span
      className={cn("themed-condition", `themed-condition--${normalizedCondition}`, className)}
      {...props}
    >
      {showLabel ? label : null}
    </span>
  );
}

// Loan status badge
type LoanStatusType = "active" | "overdue" | "due_soon" | "returned";

export interface LoanStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: LoanStatusType | string;
}

const loanStatusLabels: Record<string, string> = {
  active: "Active", ACTIVE: "Active",
  overdue: "Overdue", OVERDUE: "Overdue",
  due_soon: "Due Soon", DUE_SOON: "Due Soon",
  returned: "Returned", RETURNED: "Returned",
};

export function LoanStatusBadge({
  status,
  className,
  ...props
}: LoanStatusBadgeProps) {
  const label = loanStatusLabels[status] || status;
  const normalizedStatus = status.toLowerCase().replace("_", "-");

  return (
    <span
      className={cn("themed-loan-status", `themed-loan-status--${normalizedStatus}`, className)}
      {...props}
    >
      {label}
    </span>
  );
}

// Chip (filter-style badge)
export interface ChipProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  selected?: boolean;
  icon?: React.ReactNode;
}

export function Chip({
  children,
  selected,
  icon,
  className,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      className={cn("themed-chip", selected && "themed-chip--active", className)}
      {...props}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}
