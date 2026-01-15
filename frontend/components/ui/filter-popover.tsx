import * as React from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface FilterPopoverProps {
  /** Number of active filters to display in badge */
  activeFilterCount?: number;
  /** Content to display in the popover */
  children: React.ReactNode;
  /** Optional className for the popover content */
  className?: string;
}

/**
 * FilterPopover provides a popover button for filter controls
 *
 * @example
 * ```tsx
 * <FilterPopover activeFilterCount={filterCount}>
 *   <div className="space-y-4">
 *     <div>
 *       <label>Category</label>
 *       <Select>...</Select>
 *     </div>
 *   </div>
 * </FilterPopover>
 * ```
 */
export function FilterPopover({
  activeFilterCount = 0,
  children,
  className,
}: FilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge
              variant="default"
              className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-80", className)}
        align="start"
        side="bottom"
      >
        <div className="space-y-4">
          <div className="font-medium">Filter by</div>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
