"use client";

import { useState, useCallback } from "react";
import { useBulkSelection, type UseBulkSelectionReturn } from "./use-bulk-selection";

export interface UseSelectionModeReturn<T> extends UseBulkSelectionReturn<T> {
  /** Whether selection mode is active */
  isSelectionMode: boolean;
  /** Enter selection mode (optionally selecting an initial item) */
  enterSelectionMode: (initialId?: T) => void;
  /** Exit selection mode and clear all selections */
  exitSelectionMode: () => void;
  /** Toggle selection mode */
  toggleSelectionMode: () => void;
}

/**
 * Hook for managing selection mode state with bulk selection
 *
 * Combines selection mode toggle with useBulkSelection for complete
 * multi-select functionality. Use with SelectableListItem component.
 *
 * @example
 * ```tsx
 * const {
 *   isSelectionMode,
 *   enterSelectionMode,
 *   exitSelectionMode,
 *   selectedIds,
 *   toggleSelection,
 *   isSelected,
 * } = useSelectionMode<string>();
 *
 * // Long press enters selection mode
 * <SelectableListItem
 *   id={item.id}
 *   selectionMode={isSelectionMode}
 *   selected={isSelected(item.id)}
 *   onSelect={toggleSelection}
 *   onEnterSelectionMode={enterSelectionMode}
 * >
 *   {item.name}
 * </SelectableListItem>
 * ```
 */
export function useSelectionMode<T = string>(): UseSelectionModeReturn<T> {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const bulkSelection = useBulkSelection<T>();

  const enterSelectionMode = useCallback(
    (initialId?: T) => {
      setIsSelectionMode(true);
      if (initialId !== undefined) {
        bulkSelection.selectItem(initialId);
      }
    },
    [bulkSelection]
  );

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    bulkSelection.clearSelection();
  }, [bulkSelection]);

  const toggleSelectionMode = useCallback(() => {
    if (isSelectionMode) {
      exitSelectionMode();
    } else {
      setIsSelectionMode(true);
    }
  }, [isSelectionMode, exitSelectionMode]);

  return {
    isSelectionMode,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectionMode,
    ...bulkSelection,
  };
}
