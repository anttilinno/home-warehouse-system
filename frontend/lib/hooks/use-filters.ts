import { useState, useCallback, useMemo } from "react";

/**
 * Supported filter types
 */
export type FilterType =
  | "text"
  | "select"
  | "multi-select"
  | "date-range"
  | "boolean"
  | "number-range";

/**
 * Filter value types based on filter type
 */
export type FilterValue =
  | string
  | string[]
  | { from: Date | null; to: Date | null }
  | { min: number | null; max: number | null }
  | boolean;

/**
 * Individual filter definition
 */
export interface Filter {
  key: string;
  label: string;
  value: FilterValue;
  type: FilterType;
}

/**
 * Filter chip for display
 */
export interface FilterChip {
  key: string;
  label: string;
  displayValue: string;
}

export interface UseFiltersReturn {
  /** Map of active filters by key */
  filters: Map<string, Filter>;
  /** Array of active filters */
  activeFilters: Filter[];
  /** Count of active filters */
  activeFilterCount: number;
  /** Filter chips for UI display */
  filterChips: FilterChip[];
  /** Add or update a filter */
  addFilter: (filter: Filter) => void;
  /** Remove a filter by key */
  removeFilter: (key: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Check if a filter exists */
  hasFilter: (key: string) => boolean;
  /** Get a specific filter */
  getFilter: (key: string) => Filter | undefined;
}

/**
 * Format filter value for display in chips
 */
function formatFilterValue(filter: Filter): string {
  switch (filter.type) {
    case "text":
    case "select":
      return String(filter.value);

    case "multi-select":
      const values = filter.value as string[];
      if (values.length === 1) return values[0];
      return `${values[0]} +${values.length - 1}`;

    case "date-range": {
      const range = filter.value as { from: Date | null; to: Date | null };
      if (range.from && range.to) {
        return `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`;
      }
      if (range.from) {
        return `From ${range.from.toLocaleDateString()}`;
      }
      if (range.to) {
        return `Until ${range.to.toLocaleDateString()}`;
      }
      return "";
    }

    case "number-range": {
      const range = filter.value as { min: number | null; max: number | null };
      if (range.min !== null && range.max !== null) {
        return `${range.min} - ${range.max}`;
      }
      if (range.min !== null) {
        return `≥ ${range.min}`;
      }
      if (range.max !== null) {
        return `≤ ${range.max}`;
      }
      return "";
    }

    case "boolean":
      return filter.value ? "Yes" : "No";

    default:
      return String(filter.value);
  }
}

/**
 * Check if a filter has a valid value
 */
function isFilterValid(filter: Filter): boolean {
  switch (filter.type) {
    case "text":
    case "select":
      return Boolean(filter.value);

    case "multi-select":
      return Array.isArray(filter.value) && filter.value.length > 0;

    case "date-range": {
      const range = filter.value as { from: Date | null; to: Date | null };
      return range.from !== null || range.to !== null;
    }

    case "number-range": {
      const range = filter.value as { min: number | null; max: number | null };
      return range.min !== null || range.max !== null;
    }

    case "boolean":
      return typeof filter.value === "boolean";

    default:
      return false;
  }
}

/**
 * Hook for managing filters with chip UI support
 *
 * @example
 * ```tsx
 * const { filters, filterChips, addFilter, removeFilter, clearFilters } = useFilters();
 *
 * // Add a filter
 * addFilter({
 *   key: "category",
 *   label: "Category",
 *   value: ["Electronics", "Tools"],
 *   type: "multi-select",
 * });
 *
 * // Display filter chips
 * {filterChips.map(chip => (
 *   <FilterChip key={chip.key} onRemove={() => removeFilter(chip.key)}>
 *     {chip.label}: {chip.displayValue}
 *   </FilterChip>
 * ))}
 * ```
 */
export function useFilters(): UseFiltersReturn {
  const [filters, setFilters] = useState<Map<string, Filter>>(new Map());

  const activeFilters = useMemo(() => {
    return Array.from(filters.values()).filter(isFilterValid);
  }, [filters]);

  const activeFilterCount = activeFilters.length;

  const filterChips = useMemo(() => {
    return activeFilters.map((filter) => ({
      key: filter.key,
      label: filter.label,
      displayValue: formatFilterValue(filter),
    }));
  }, [activeFilters]);

  const addFilter = useCallback((filter: Filter) => {
    setFilters((prev) => {
      const next = new Map(prev);
      if (isFilterValid(filter)) {
        next.set(filter.key, filter);
      } else {
        next.delete(filter.key);
      }
      return next;
    });
  }, []);

  const removeFilter = useCallback((key: string) => {
    setFilters((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(new Map());
  }, []);

  const hasFilter = useCallback(
    (key: string) => {
      return filters.has(key);
    },
    [filters]
  );

  const getFilter = useCallback(
    (key: string) => {
      return filters.get(key);
    },
    [filters]
  );

  return {
    filters,
    activeFilters,
    activeFilterCount,
    filterChips,
    addFilter,
    removeFilter,
    clearFilters,
    hasFilter,
    getFilter,
  };
}
