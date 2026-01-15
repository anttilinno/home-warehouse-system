import { useState, useCallback, useMemo } from "react";

export interface UseBulkSelectionReturn<T> {
  /** Set of selected item IDs */
  selectedIds: Set<T>;
  /** Array of selected item IDs */
  selectedIdsArray: T[];
  /** Number of selected items */
  selectedCount: number;
  /** Toggle selection for a single item */
  toggleSelection: (id: T) => void;
  /** Select a single item */
  selectItem: (id: T) => void;
  /** Deselect a single item */
  deselectItem: (id: T) => void;
  /** Select all items from the provided array */
  selectAll: (ids: T[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if an item is selected */
  isSelected: (id: T) => boolean;
  /** Check if all items are selected */
  isAllSelected: (ids: T[]) => boolean;
  /** Check if some items are selected (but not all) */
  isSomeSelected: (ids: T[]) => boolean;
}

/**
 * Hook for managing bulk selection state in tables
 * Supports selecting multiple items with checkboxes
 *
 * @returns Bulk selection state and control functions
 *
 * @example
 * ```tsx
 * const items = [{ id: "1", name: "Item 1" }, { id: "2", name: "Item 2" }];
 * const {
 *   selectedIds,
 *   toggleSelection,
 *   selectAll,
 *   clearSelection,
 *   isSelected,
 *   isAllSelected,
 * } = useBulkSelection<string>();
 *
 * // In your table:
 * <Checkbox
 *   checked={isSelected(item.id)}
 *   onCheckedChange={() => toggleSelection(item.id)}
 * />
 *
 * // Select all checkbox:
 * <Checkbox
 *   checked={isAllSelected(items.map(i => i.id))}
 *   onCheckedChange={(checked) => {
 *     if (checked) {
 *       selectAll(items.map(i => i.id));
 *     } else {
 *       clearSelection();
 *     }
 *   }}
 * />
 * ```
 */
export function useBulkSelection<T = string>(): UseBulkSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.size;

  const toggleSelection = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectItem = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  }, []);

  const deselectItem = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: T) => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  const isAllSelected = useCallback(
    (ids: T[]) => {
      if (ids.length === 0) return false;
      return ids.every((id) => selectedIds.has(id));
    },
    [selectedIds]
  );

  const isSomeSelected = useCallback(
    (ids: T[]) => {
      if (ids.length === 0) return false;
      const allSelected = isAllSelected(ids);
      const someSelected = ids.some((id) => selectedIds.has(id));
      return someSelected && !allSelected;
    },
    [selectedIds, isAllSelected]
  );

  return {
    selectedIds,
    selectedIdsArray,
    selectedCount,
    toggleSelection,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isSomeSelected,
  };
}
