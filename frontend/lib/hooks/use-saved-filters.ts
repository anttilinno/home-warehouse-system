import { useState, useEffect, useCallback } from "react";

export interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, any>;
  createdAt: string;
  isDefault?: boolean;
}

interface UseSavedFiltersOptions {
  storageKey: string;
  onApplyFilter?: (filters: Record<string, any>) => void;
}

export function useSavedFilters({
  storageKey,
  onApplyFilter,
}: UseSavedFiltersOptions) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSavedFilters(parsed);

        // Auto-apply default filter if exists
        const defaultFilter = parsed.find((f: SavedFilter) => f.isDefault);
        if (defaultFilter && onApplyFilter) {
          onApplyFilter(defaultFilter.filters);
        }
      }
    } catch (error) {
      console.error("Failed to load saved filters:", error);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, onApplyFilter]);

  // Save filters to localStorage whenever they change
  const persistFilters = useCallback(
    (filters: SavedFilter[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(filters));
      } catch (error) {
        console.error("Failed to save filters:", error);
      }
    },
    [storageKey]
  );

  // Save a new filter
  const saveFilter = useCallback(
    (name: string, filters: Record<string, any>, isDefault = false) => {
      const newFilter: SavedFilter = {
        id: Date.now().toString(),
        name,
        filters,
        createdAt: new Date().toISOString(),
        isDefault,
      };

      // If setting as default, remove default from others
      const updatedFilters = isDefault
        ? savedFilters.map((f) => ({ ...f, isDefault: false }))
        : savedFilters;

      const newFilters = [...updatedFilters, newFilter];
      setSavedFilters(newFilters);
      persistFilters(newFilters);

      return newFilter;
    },
    [savedFilters, persistFilters]
  );

  // Delete a saved filter
  const deleteFilter = useCallback(
    (id: string) => {
      const newFilters = savedFilters.filter((f) => f.id !== id);
      setSavedFilters(newFilters);
      persistFilters(newFilters);
    },
    [savedFilters, persistFilters]
  );

  // Update a saved filter
  const updateFilter = useCallback(
    (id: string, updates: Partial<SavedFilter>) => {
      const newFilters = savedFilters.map((f) => {
        if (f.id === id) {
          // If setting as default, remove default from others
          if (updates.isDefault) {
            return { ...f, ...updates };
          }
          return { ...f, ...updates };
        }
        // Remove default from other filters if setting a new default
        if (updates.isDefault) {
          return { ...f, isDefault: false };
        }
        return f;
      });
      setSavedFilters(newFilters);
      persistFilters(newFilters);
    },
    [savedFilters, persistFilters]
  );

  // Apply a saved filter
  const applyFilter = useCallback(
    (id: string) => {
      const filter = savedFilters.find((f) => f.id === id);
      if (filter && onApplyFilter) {
        onApplyFilter(filter.filters);
      }
      return filter;
    },
    [savedFilters, onApplyFilter]
  );

  // Set a filter as default
  const setAsDefault = useCallback(
    (id: string) => {
      updateFilter(id, { isDefault: true });
    },
    [updateFilter]
  );

  // Get the default filter
  const getDefaultFilter = useCallback(() => {
    return savedFilters.find((f) => f.isDefault);
  }, [savedFilters]);

  return {
    savedFilters,
    isLoading,
    saveFilter,
    deleteFilter,
    updateFilter,
    applyFilter,
    setAsDefault,
    getDefaultFilter,
  };
}
