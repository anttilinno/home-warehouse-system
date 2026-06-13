// Scan-component barrel (Phase 11). This plan (11-05) owns the barrel as the
// single writer.
//
// SCOPE DECISION (binding hard-rule fallback): the 11-04 camera components
// (BarcodeScanner / ScanViewfinderOverlay / ScanTorchToggle) are authored by the
// PARALLEL same-wave plan 11-04 and do NOT exist in this worktree — re-exporting
// them here would break `tsc -b` for 11-05. Per the executor instruction, the
// barrel therefore exports ONLY the 11-05 components; 11-06/11-04 import the
// camera components directly from their own paths.
export {
  ScanResultBanner,
  type ScanResultBannerProps,
  type ScanBannerStatus,
} from "./ScanResultBanner";
export {
  ManualBarcodeEntry,
  type ManualBarcodeEntryProps,
} from "./ManualBarcodeEntry";
export {
  ScanHistoryList,
  type ScanHistoryListProps,
} from "./ScanHistoryList";
export {
  QuickActionMenu,
  type QuickActionMenuProps,
} from "./QuickActionMenu";
export {
  UpcSuggestionBanner,
  type UpcSuggestionBannerProps,
  type UpcSuggestion,
} from "./UpcSuggestionBanner";
