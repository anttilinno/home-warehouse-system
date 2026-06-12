// Retro OS pastel component barrel — locked v2.0 convention: all retro
// component imports go through @/components/retro.
export { Window, type WindowProps, type TitlebarVariant } from "./Window";
export {
  BevelButton,
  type BevelButtonProps,
  type BevelButtonVariant,
} from "./BevelButton";
export { RetroInput, type RetroInputProps } from "./RetroInput";
export {
  RetroBadge,
  type RetroBadgeProps,
  type RetroBadgeVariant,
} from "./RetroBadge";
export { StatCard, type StatCardProps, type StatValueTone } from "./StatCard";
export { RetroTable, type RetroTableProps } from "./RetroTable";

// Phase 4 subdir barrels (aggregated through the single @/components/retro
// barrel — locked v2.0 convention). `overlay` ships in this plan (04-01).
export * from "./overlay";
export * from "./form";
export * from "./feedback";
export * from "./data";
// The feedback/data/filters subdir re-exports are added by their owning plans
// as they land (Waves 2-3). They are intentionally NOT declared here yet: those
// directories may not exist on this branch, so a re-export now would break
// `tsc -b` / the build for this plan AND for the parallel plans that import this
// barrel. Each owning plan appends its own line.
