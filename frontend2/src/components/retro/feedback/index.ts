// Retro OS pastel feedback-family barrel (Phase 4). RetroStatusDot (TUI-03),
// StatusPill (TUI-04), RetroEmptyState, RetroToaster (sonner skin) + retroToast.
// Toast engine arbitration: sonner@2.0.7 (Plan 04-01) supersedes the UI-SPEC
// "sonner declined" note on the ENGINE only — the toast VISUAL contract stays
// UI-SPEC-binding (mini-Window chrome, semantic titlebars, danger never auto).
export { RetroToaster } from "./RetroToast";
export { retroToast } from "./retroToast";
export {
  RetroStatusDot,
  type RetroStatusDotProps,
  type RetroStatusDotState,
} from "./RetroStatusDot";
export {
  StatusPill,
  type StatusPillProps,
  type StatusPillVariant,
} from "./StatusPill";
export {
  RetroEmptyState,
  type RetroEmptyStateProps,
  type RetroEmptyStateAction,
} from "./RetroEmptyState";
