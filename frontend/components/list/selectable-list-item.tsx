"use client";

import { useCallback } from "react";
import { LongPressEventType, useLongPress } from "use-long-press";
import { Checkbox } from "@/components/ui/checkbox";
import { triggerHaptic } from "@/lib/hooks/use-haptic";
import { cn } from "@/lib/utils";

interface SelectableListItemProps {
  /** Unique identifier for this item */
  id: string;
  /** Content to render inside the list item */
  children: React.ReactNode;
  /** Whether selection mode is currently active */
  selectionMode: boolean;
  /** Whether this item is currently selected */
  selected: boolean;
  /** Callback when item selection changes */
  onSelect: (id: string) => void;
  /** Callback to enter selection mode (called on long press) */
  onEnterSelectionMode: (id: string) => void;
  /** Additional className for the container */
  className?: string;
  /** Disable long-press functionality */
  disableLongPress?: boolean;
}

/**
 * List item with long-press to enter selection mode
 *
 * Features:
 * - Long press (500ms) enters selection mode and selects this item
 * - Movement during press (>25px) cancels to allow scrolling
 * - Haptic feedback on long press and selection
 * - Checkbox appears when in selection mode
 * - Click toggles selection when in selection mode
 *
 * @example
 * ```tsx
 * <SelectableListItem
 *   id={item.id}
 *   selectionMode={isSelectionMode}
 *   selected={isSelected(item.id)}
 *   onSelect={toggleSelection}
 *   onEnterSelectionMode={enterSelectionMode}
 * >
 *   <div className="flex items-center gap-3">
 *     <span>{item.name}</span>
 *   </div>
 * </SelectableListItem>
 * ```
 */
export function SelectableListItem({
  id,
  children,
  selectionMode,
  selected,
  onSelect,
  onEnterSelectionMode,
  className,
  disableLongPress = false,
}: SelectableListItemProps) {
  // Long press handler - enters selection mode
  const longPressHandlers = useLongPress(
    () => {
      if (!selectionMode) {
        triggerHaptic("tap");
        onEnterSelectionMode(id);
      }
    },
    {
      threshold: 500, // 500ms to trigger
      cancelOnMovement: 25, // Cancel if moved more than 25px (allows scrolling)
      detect: LongPressEventType.Touch, // Touch only (not mouse - mouse has right-click)
    }
  );

  // Click handler - toggles selection when in selection mode
  const handleClick = useCallback(() => {
    if (selectionMode) {
      triggerHaptic("tap");
      onSelect(id);
    }
  }, [selectionMode, id, onSelect]);

  // Handle checkbox change
  const handleCheckboxChange = useCallback(
    (checked: boolean | "indeterminate") => {
      if (checked === true || checked === false) {
        triggerHaptic("tap");
        onSelect(id);
      }
    },
    [id, onSelect]
  );

  // Prevent context menu on long press (native browser behavior)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!disableLongPress) {
        e.preventDefault();
      }
    },
    [disableLongPress]
  );

  return (
    <div
      {...(disableLongPress ? {} : longPressHandlers())}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer",
        "hover:bg-muted/50 active:bg-muted/70",
        "transition-colors duration-150",
        selected && "bg-primary/10",
        className
      )}
      role="listitem"
      aria-selected={selectionMode ? selected : undefined}
      data-selected={selected || undefined}
    >
      {selectionMode && (
        <Checkbox
          checked={selected}
          onCheckedChange={handleCheckboxChange}
          aria-label={`Select item ${id}`}
          className="shrink-0"
          onClick={(e) => e.stopPropagation()} // Prevent double-toggle
        />
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
