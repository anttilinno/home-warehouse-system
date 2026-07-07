// Filter-atom barrel (Phase 4 Plan 04-06). Aggregated through the single
// @/components/retro barrel — locked v2.0 convention.
export {
  FilterBar,
  type FilterBarProps,
  type FilterChip,
  type FilterFacet,
} from "./FilterBar";
export {
  FilterPopover,
  type FilterPopoverProps,
  type FilterFacetOption,
} from "./FilterPopover";
export {
  type FilterDef,
  type FilterOption,
  type FilterValues,
  chipsForDefs,
  readFilterValues,
} from "./filterDefs";
export {
  useUrlFilterState,
  type FilterState,
  type UseUrlFilterStateOptions,
} from "./useUrlFilterState";
export { filterFacetsFor } from "./FilterDefFacets";
export {
  BulkActionBar,
  type BulkActionBarProps,
  type DestructiveBulkAction,
} from "./BulkActionBar";
export { SavedFilters, type SavedFiltersProps } from "./SavedFilters";
export {
  useSavedFilters,
  type SavedFilter,
  type UseSavedFiltersOptions,
} from "./useSavedFilters";
