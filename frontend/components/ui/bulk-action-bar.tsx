"use client";

import * as React from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface BulkActionBarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Callback when clear selection is clicked */
  onClear: () => void;
  /** Action buttons to display */
  children?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Bulk action bar component that appears when items are selected
 * Shows selection count and action buttons
 * Sticky to the bottom of the viewport with slide-up animation
 *
 * @example
 * ```tsx
 * <BulkActionBar selectedCount={5} onClear={clearSelection}>
 *   <Button onClick={handleExport}>
 *     <Download className="h-4 w-4 mr-2" />
 *     Export
 *   </Button>
 *   <Button onClick={handleArchive} variant="destructive">
 *     <Archive className="h-4 w-4 mr-2" />
 *     Archive
 *   </Button>
 * </BulkActionBar>
 * ```
 */
export const BulkActionBar = React.memo(function BulkActionBar({
  selectedCount,
  onClear,
  children,
  className,
}: BulkActionBarProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  // Trigger animation when selectedCount changes
  React.useEffect(() => {
    if (selectedCount > 0) {
      setIsVisible(true);
    } else {
      // Delay hiding to allow exit animation
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [selectedCount]);

  if (!isVisible && selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg transition-all duration-200 ease-in-out",
        selectedCount > 0
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0",
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-between gap-4 p-4">
        {/* Selection info */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold" aria-live="polite">
              {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
            </span>
            <span className="text-xs text-muted-foreground">
              Choose an action below
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {children}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="ml-2"
          >
            <X className="mr-2 h-4 w-4" />
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  );
});
