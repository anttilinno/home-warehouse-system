import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig<T = any> {
  key: keyof T | null;
  direction: SortDirection;
}

export interface UseTableSortReturn<T> {
  sortConfig: SortConfig<T>;
  sortedData: T[];
  requestSort: (key: keyof T) => void;
  getSortDirection: (key: keyof T) => SortDirection;
}

/**
 * Hook for managing table sorting state and logic
 * Supports string, number, and date sorting
 *
 * @param data - Array of data to sort
 * @param defaultSortKey - Initial sort key
 * @param defaultSortDirection - Initial sort direction
 * @returns Sorted data and sort control functions
 */
export function useTableSort<T extends Record<string, any>>(
  data: T[],
  defaultSortKey: keyof T | null = null,
  defaultSortDirection: SortDirection = "asc"
): UseTableSortReturn<T> {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: defaultSortKey,
    direction: defaultSortDirection,
  });

  const requestSort = useCallback((key: keyof T) => {
    setSortConfig((prevConfig) => {
      // If clicking the same column, cycle through: asc -> desc -> null
      if (prevConfig.key === key) {
        if (prevConfig.direction === "asc") {
          return { key, direction: "desc" };
        } else if (prevConfig.direction === "desc") {
          return { key: null, direction: null };
        }
      }
      // If clicking a different column, start with asc
      return { key, direction: "asc" };
    });
  }, []);

  const getSortDirection = useCallback(
    (key: keyof T): SortDirection => {
      return sortConfig.key === key ? sortConfig.direction : null;
    },
    [sortConfig]
  );

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data;
    }

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Determine the type and compare accordingly
      if (typeof aValue === "number" && typeof bValue === "number") {
        // Number comparison
        return aValue - bValue;
      } else if (typeof aValue === "string" && typeof bValue === "string") {
        // Try to parse as dates if they look like ISO strings
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return aDate.getTime() - bDate.getTime();
        }
        // Fallback to string comparison (case-insensitive)
        return aValue.toLowerCase().localeCompare(bValue.toLowerCase());
      } else if (
        aValue &&
        bValue &&
        typeof aValue === "object" &&
        typeof bValue === "object" &&
        "getTime" in aValue &&
        "getTime" in bValue
      ) {
        // Date comparison (check if they have getTime method)
        return (aValue as Date).getTime() - (bValue as Date).getTime();
      } else {
        // Fallback: convert to string and compare
        return String(aValue)
          .toLowerCase()
          .localeCompare(String(bValue).toLowerCase());
      }
    });

    // Reverse if descending
    return sortConfig.direction === "desc" ? sorted.reverse() : sorted;
  }, [data, sortConfig]);

  return {
    sortConfig,
    sortedData,
    requestSort,
    getSortDirection,
  };
}
