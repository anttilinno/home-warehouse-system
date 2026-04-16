import { useLingui } from "@lingui/react/macro";

export interface ShowArchivedChipProps {
  active: boolean;
  count: number;
  onToggle: () => void;
}

/**
 * Local filter chip — "SHOW ARCHIVED" toggle above the items table.
 *
 * Not a global primitive (UI-SPEC: "one-off composition"). If other phases
 * need a chip, promote to @/components/retro in a future refactor.
 *
 * Color rule #6 (UI-SPEC): on-state uses amber border + text; off-state uses
 * ink. Touch target: 44px mobile, 32px desktop.
 */
export function ShowArchivedChip({
  active,
  count,
  onToggle,
}: ShowArchivedChipProps) {
  const { t } = useLingui();
  const stateCls = active
    ? "border-retro-amber text-retro-amber"
    : "border-retro-ink text-retro-ink";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`min-h-[44px] lg:min-h-[32px] inline-flex items-center gap-xs px-sm border-retro-thick bg-retro-cream font-sans text-[14px] font-semibold uppercase tracking-wider cursor-pointer outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber ${stateCls}`}
    >
      {active ? t`SHOWING ARCHIVED` : t`SHOW ARCHIVED`}
      <span className="font-mono text-retro-charcoal">·</span>
      <span
        className={`font-mono ${
          active ? "text-retro-amber" : "text-retro-charcoal"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
