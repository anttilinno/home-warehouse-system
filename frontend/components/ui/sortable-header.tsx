import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { SortDirection } from "@/lib/hooks/use-table-sort";
import { cn } from "@/lib/utils";

interface SortableHeaderProps {
  label: string;
  sortDirection: SortDirection;
  onClick: () => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortDirection,
  onClick,
  className,
}: SortableHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 font-medium text-sm hover:text-foreground transition-colors",
        sortDirection ? "text-foreground" : "text-muted-foreground",
        className
      )}
      aria-sort={
        sortDirection === "asc"
          ? "ascending"
          : sortDirection === "desc"
          ? "descending"
          : "none"
      }
    >
      <span>{label}</span>
      {sortDirection === "asc" ? (
        <ArrowUp className="h-4 w-4" />
      ) : sortDirection === "desc" ? (
        <ArrowDown className="h-4 w-4" />
      ) : (
        <ArrowUpDown className="h-4 w-4 opacity-50" />
      )}
    </button>
  );
}
