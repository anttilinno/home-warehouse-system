import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FilterChip } from "@/lib/hooks/use-filters";

export interface FilterBarProps {
  /** Filter chips to display */
  filterChips: FilterChip[];
  /** Callback when a filter chip is removed */
  onRemoveFilter: (key: string) => void;
  /** Callback when clear all is clicked */
  onClearAll: () => void;
  /** Optional className */
  className?: string;
}

/**
 * FilterBar displays active filters as removable chips with a clear all button
 *
 * @example
 * ```tsx
 * <FilterBar
 *   filterChips={filterChips}
 *   onRemoveFilter={removeFilter}
 *   onClearAll={clearFilters}
 * />
 * ```
 */
export const FilterBar = React.memo(function FilterBar({
  filterChips,
  onRemoveFilter,
  onClearAll,
  className,
}: FilterBarProps) {
  if (filterChips.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-3",
        className
      )}
    >
      <span className="text-sm text-muted-foreground">Filters:</span>
      {filterChips.map((chip) => (
        <FilterChipItem
          key={chip.key}
          chip={chip}
          onRemove={() => onRemoveFilter(chip.key)}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-7 px-2 text-xs"
      >
        Clear all
      </Button>
    </div>
  );
});

interface FilterChipItemProps {
  chip: FilterChip;
  onRemove: () => void;
}

const FilterChipItem = React.memo(function FilterChipItem({ chip, onRemove }: FilterChipItemProps) {
  return (
    <Badge
      variant="secondary"
      className="group flex items-center gap-1.5 pl-2 pr-1 text-xs font-normal"
    >
      <span className="text-muted-foreground">{chip.label}:</span>
      <span className="font-medium">{chip.displayValue}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={`Remove ${chip.label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
});
