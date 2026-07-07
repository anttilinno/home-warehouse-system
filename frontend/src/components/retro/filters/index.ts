// Filter-atom barrel (Phase 4 Plan 04-06; design 1c). Aggregated through the
// single @/components/retro barrel — locked v2.0 convention.
export {
  type FilterDef,
  type FilterOption,
  type FilterValues,
  type FilterChip,
  chipsForDefs,
  readFilterValues,
} from "./filterDefs";
export {
  useUrlFilterState,
  readTerms,
  TERMS_KEY,
  type FilterState,
  type UseUrlFilterStateOptions,
} from "./useUrlFilterState";
export {
  TokenField,
  type TokenFieldProps,
  type FieldToken,
} from "./TokenField";
export { ViewMenu, type ViewMenuProps } from "./ViewMenu";
export { ViewBar, type ViewBarProps } from "./ViewBar";
export { useListViews, type UseListViewsOptions } from "./useListViews";
export { searchFragments, matchesFragments } from "./searchMatch";
export {
  useSavedViews,
  viewDiff,
  toViewSnapshot,
  snapshotIsEmpty,
  ALL_VIEW_ID,
  NON_VIEW_KEYS,
  type SavedView,
  type UseSavedViewsOptions,
} from "./useSavedViews";
export {
  BulkActionBar,
  type BulkActionBarProps,
  type DestructiveBulkAction,
} from "./BulkActionBar";
