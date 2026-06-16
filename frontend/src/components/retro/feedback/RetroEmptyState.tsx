import type { ReactNode } from "react";
import { BevelButton } from "@/components/retro";

export interface RetroEmptyStateAction {
  label: ReactNode;
  onClick: () => void;
}

export interface RetroEmptyStateProps {
  /** Optional 10px uppercase eyebrow (group label scale). */
  eyebrow?: ReactNode;
  /** Decorative unicode glyph in the thumb frame (default ◇). */
  glyph?: ReactNode;
  /** 16px Silkscreen uppercase heading. */
  heading: ReactNode;
  /** 14px muted body — one sentence + next step. */
  body: ReactNode;
  /** Optional primary recovery CTA. */
  action?: RetroEmptyStateAction;
}

// RetroEmptyState — centered placeholder for empty/filtered lists & tables.
// Copy is supplied by the consumer (wrap call-site strings in <Trans>); the
// atom owns layout + chrome only, per UI-SPEC § Feedback Family.
export function RetroEmptyState({
  eyebrow,
  glyph = "◇",
  heading,
  body,
  action,
}: Readonly<RetroEmptyStateProps>) {
  return (
    <div className="flex flex-col items-center gap-sp-2 px-sp-4 py-sp-5 text-center">
      {eyebrow && (
        <p className="text-10 font-bold uppercase tracking-14 text-fg-muted">
          {eyebrow}
        </p>
      )}
      {/* 32px glyph in a 1px ink-bordered square thumb — faint is sanctioned
          here (decorative). */}
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center border border-border-ink bg-bg-panel-2 text-32 leading-none text-fg-faint"
      >
        {glyph}
      </span>
      <h3 className="font-display text-16 uppercase text-fg-ink">{heading}</h3>
      <p className="max-w-[42ch] text-14 text-fg-muted">{body}</p>
      {action && (
        <BevelButton variant="primary" onClick={action.onClick}>
          {action.label}
        </BevelButton>
      )}
    </div>
  );
}
