import type { ReactNode } from "react";
import { RetroBadge } from "@/components/retro";

export type StatusPillVariant = "ok" | "warn" | "info" | "danger";

export interface StatusPillProps {
  variant: StatusPillVariant;
  children: ReactNode;
}

// StatusPill (TUI-04) — OK/WARN/INFO/DANGER status pills, a thin preset over the
// shipped RetroBadge chrome. Variant passes straight through to RetroBadge,
// which already maps ok/warn/info/danger to the LOCKED pastel fills with ink
// text (the "pastel fills carry ink text ONLY" rule). No new tokens, no
// *-deep companion text inside the fill, no new contrast pairing.
export function StatusPill({ variant, children }: StatusPillProps) {
  return <RetroBadge variant={variant}>{children}</RetroBadge>;
}
