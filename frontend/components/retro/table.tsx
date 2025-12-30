"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   RetroTable - Compound component for retro-styled tables

   Usage:
   <RetroTable>
     <RetroTable.Head>
       <RetroTable.Row>
         <RetroTable.Th>Column 1</RetroTable.Th>
         <RetroTable.Th align="right">Column 2</RetroTable.Th>
       </RetroTable.Row>
     </RetroTable.Head>
     <RetroTable.Body>
       <RetroTable.Row clickable onClick={() => {}}>
         <RetroTable.Td>Value 1</RetroTable.Td>
         <RetroTable.Td align="right">Value 2</RetroTable.Td>
       </RetroTable.Row>
     </RetroTable.Body>
   </RetroTable>
   ========================================================================== */

interface RetroTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  scroll?: boolean;
}

interface RetroTableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

interface RetroTableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

interface RetroTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  clickable?: boolean;
  selected?: boolean;
}

interface RetroTableThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  active?: boolean;
  compact?: boolean;
}

interface RetroTableTdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  muted?: boolean;
  compact?: boolean;
  nowrap?: boolean;
  truncate?: boolean;
}

// Table wrapper with sticky scrollbar
function RetroTableRoot({ children, scroll = false, className, ...props }: RetroTableProps) {
  const tableRef = React.useRef<HTMLDivElement>(null);
  const scrollbarRef = React.useRef<HTMLDivElement>(null);
  const [showStickyScrollbar, setShowStickyScrollbar] = React.useState(false);
  const [scrollWidth, setScrollWidth] = React.useState(0);
  const [clientWidth, setClientWidth] = React.useState(0);

  React.useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const checkOverflow = () => {
      const hasOverflow = table.scrollWidth > table.clientWidth;
      setShowStickyScrollbar(hasOverflow);
      setScrollWidth(table.scrollWidth);
      setClientWidth(table.clientWidth);
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
    <div className={cn("retro-table-container", className)} {...props}>
      <div
        ref={tableRef}
        className="retro-table-wrap"
        onScroll={() => syncScroll("table")}
      >
        <table className="retro-table">{children}</table>
      </div>
      {showStickyScrollbar && (
        <div
          ref={scrollbarRef}
          className="retro-table-sticky-scrollbar"
          onScroll={() => syncScroll("scrollbar")}
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}

// Table head
function RetroTableHead({ children, className, ...props }: RetroTableHeadProps) {
  return (
    <thead className={cn("retro-thead", className)} {...props}>
      {children}
    </thead>
  );
}

// Table body
function RetroTableBody({ children, className, ...props }: RetroTableBodyProps) {
  return (
    <tbody className={cn("retro-tbody", className)} {...props}>
      {children}
    </tbody>
  );
}

// Table row
function RetroTableRow({
  children,
  clickable,
  selected,
  className,
  ...props
}: RetroTableRowProps) {
  return (
    <tr
      className={cn(
        "retro-tr",
        clickable && "retro-tr--clickable",
        selected && "retro-tr--selected",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

// Table header cell
function RetroTableTh({
  children,
  align = "left",
  sortable,
  active,
  compact,
  className,
  ...props
}: RetroTableThProps) {
  return (
    <th
      className={cn(
        "retro-th",
        align === "right" && "retro-th--right",
        align === "center" && "retro-th--center",
        sortable && "retro-th--sortable",
        active && "retro-th--active",
        compact && "retro-th--compact",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

// Table data cell
function RetroTableTd({
  children,
  align = "left",
  muted,
  compact,
  nowrap,
  truncate,
  className,
  ...props
}: RetroTableTdProps) {
  return (
    <td
      className={cn(
        "retro-td",
        align === "right" && "retro-td--right",
        align === "center" && "retro-td--center",
        muted && "retro-td--muted",
        compact && "retro-td--compact",
        nowrap && "retro-td--nowrap",
        truncate && "retro-td--truncate",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

// Empty state
interface RetroTableEmptyProps {
  icon?: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}

function RetroTableEmpty({ icon, message, action }: RetroTableEmptyProps) {
  return (
    <div className="retro-table__empty">
      {icon && <div className="retro-table__empty-icon">{icon}</div>}
      <p className="retro-table__empty-text">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Compose the compound component
export const RetroTable = Object.assign(RetroTableRoot, {
  Head: RetroTableHead,
  Body: RetroTableBody,
  Row: RetroTableRow,
  Th: RetroTableTh,
  Td: RetroTableTd,
  Empty: RetroTableEmpty,
});

// Also export individual components for flexibility
export {
  RetroTableHead,
  RetroTableBody,
  RetroTableRow,
  RetroTableTh,
  RetroTableTd,
  RetroTableEmpty,
};
