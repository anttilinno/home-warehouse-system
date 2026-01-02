"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   Unified Table Component - Pure CSS theming with compound components
   ========================================================================== */

export interface TableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  scroll?: boolean;
}

export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  clickable?: boolean;
  selected?: boolean;
}

export interface TableThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  active?: boolean;
  compact?: boolean;
}

export interface TableTdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  muted?: boolean;
  compact?: boolean;
  nowrap?: boolean;
  truncate?: boolean;
}

export interface TableEmptyProps {
  icon?: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}

// Table wrapper
function TableRoot({ children, scroll = false, className, ...props }: TableProps) {
  const tableRef = React.useRef<HTMLDivElement>(null);
  const scrollbarRef = React.useRef<HTMLDivElement>(null);
  const [showStickyScrollbar, setShowStickyScrollbar] = React.useState(false);
  const [scrollWidth, setScrollWidth] = React.useState(0);

  React.useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const checkOverflow = () => {
      const hasOverflow = table.scrollWidth > table.clientWidth;
      setShowStickyScrollbar(hasOverflow);
      setScrollWidth(table.scrollWidth);
    };

    checkOverflow();
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(table);
    return () => resizeObserver.disconnect();
  }, [children]);

  const syncScroll = (source: "table" | "scrollbar") => {
    const table = tableRef.current;
    const scrollbar = scrollbarRef.current;
    if (!table || !scrollbar) return;

    if (source === "table") {
      scrollbar.scrollLeft = table.scrollLeft;
    } else {
      table.scrollLeft = scrollbar.scrollLeft;
    }
  };

  return (
    <div className={cn("themed-table-container", className)} {...props}>
      <div
        ref={tableRef}
        className={cn("themed-table-wrap", scroll && "max-h-[600px] overflow-y-auto")}
        onScroll={() => syncScroll("table")}
      >
        <table className="themed-table">{children}</table>
      </div>
      {showStickyScrollbar && (
        <div
          ref={scrollbarRef}
          className="themed-table-sticky-scrollbar"
          onScroll={() => syncScroll("scrollbar")}
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}

// Table head
function TableHead({ children, className, ...props }: TableHeadProps) {
  return (
    <thead className={cn("themed-thead", className)} {...props}>
      {children}
    </thead>
  );
}

// Table body
function TableBody({ children, className, ...props }: TableBodyProps) {
  return (
    <tbody className={cn("themed-tbody", className)} {...props}>
      {children}
    </tbody>
  );
}

// Table row
function TableRow({
  children,
  clickable,
  selected,
  className,
  ...props
}: TableRowProps) {
  return (
    <tr
      className={cn(
        "themed-tr",
        clickable && "themed-tr--clickable",
        selected && "themed-tr--selected",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

// Table header cell
function TableTh({
  children,
  align = "left",
  sortable,
  active,
  compact,
  className,
  ...props
}: TableThProps) {
  return (
    <th
      className={cn(
        "themed-th",
        align === "right" && "themed-th--right",
        align === "center" && "themed-th--center",
        sortable && "themed-th--sortable",
        active && "themed-th--active",
        compact && "themed-th--compact",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

// Table data cell
function TableTd({
  children,
  align = "left",
  muted,
  compact,
  nowrap,
  truncate,
  className,
  ...props
}: TableTdProps) {
  return (
    <td
      className={cn(
        "themed-td",
        align === "right" && "themed-td--right",
        align === "center" && "themed-td--center",
        muted && "themed-td--muted",
        compact && "themed-td--compact",
        nowrap && "themed-td--nowrap",
        truncate && "themed-td--truncate",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

// Empty state
function TableEmpty({ icon, message, action }: TableEmptyProps) {
  return (
    <div className="themed-table__empty">
      {icon && <div className="themed-table__empty-icon">{icon}</div>}
      <p className="themed-table__empty-text">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Compose the compound component
export const Table = Object.assign(TableRoot, {
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  Th: TableTh,
  Td: TableTd,
  Empty: TableEmpty,
});

// Also export individual components for flexibility
export {
  TableHead,
  TableBody,
  TableRow,
  TableTh,
  TableTd,
  TableEmpty,
};
