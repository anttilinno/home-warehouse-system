import type { ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";

/** An active-filter chip (the applied filter state, one per active facet/term). */
export interface FilterChip {
  key: string;
  label: ReactNode;
  displayValue: ReactNode;
}

/** A facet trigger slot (typically a <FilterPopover>). */
export interface FilterFacet {
  key: string;
  label: ReactNode;
  trigger: ReactNode;
}

export interface FilterBarProps {
  /** Search box value (controlled). */
  searchValue: string;
  /** Called on each search keystroke. */
  onSearchChange: (value: string) => void;
  /** Search placeholder. Defaults to "Filter items…". */
  searchPlaceholder?: ReactNode;
  /** Facet trigger slots (each a <FilterPopover>). */
  facets: FilterFacet[];
  /** Total item count shown as `{n} items`. */
  itemCount: number;
  /** Active-filter chips (legacy contract). */
  filterChips: FilterChip[];
  /** Remove a single active filter by key. */
  onRemoveFilter: (key: string) => void;
  /** Reset all active filters. */
  onClearAll: () => void;
  /** Primary CTA slot (e.g. a `+ ADD ITEM` BevelButton). */
  primaryAction?: ReactNode;
  className?: string;
}

/**
 * The recessed filter toolbar (sketch-008 `.toolbar`, hardened), per UI-SPEC:
 * a search input + per-facet ▾ triggers + a mono `{n} items` count + a primary
 * CTA, with a row of removable active-filter chips (blue, ink ✕) and a
 * `CLEAR ALL` reset below. Sits above a table inside its Window body.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  facets,
  itemCount,
  filterChips,
  onRemoveFilter,
  onClearAll,
  primaryAction,
  className = "",
}: FilterBarProps) {
  const { t } = useLingui();

  return (
    <div className={`flex flex-col gap-sp-2 bg-bg-panel-2 p-sp-3 ${className}`}>
      <div className="flex items-center gap-sp-2">
        <input
          type="search"
          role="searchbox"
          aria-label={t`Filter items`}
          placeholder={
            typeof searchPlaceholder === "string"
              ? searchPlaceholder
              : t`Filter items…`
          }
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-[260px] border-2 border-border-ink bg-bg-panel px-[10px] py-[7px] text-14 text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue"
        />

        {facets.map((facet) => (
          <span key={facet.key}>{facet.trigger}</span>
        ))}

        <span className="flex-1" />

        <span className="font-mono text-12 tabular-nums text-fg-muted">
          {itemCount} <Trans>items</Trans>
        </span>

        {primaryAction}
      </div>

      {filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-sp-1">
          {filterChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-[6px] rounded-chip border border-border-ink bg-titlebar-blue px-sp-2 py-px text-11 font-bold uppercase tracking-7 text-fg-ink"
            >
              <span className="text-fg-muted">{chip.label}:</span>
              <span>{chip.displayValue}</span>
              <button
                type="button"
                aria-label={t`Remove ${String(chip.label)} filter`}
                title={t`Remove ${String(chip.label)} filter`}
                onClick={() => onRemoveFilter(chip.key)}
                className="cursor-pointer text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="cursor-pointer px-sp-1 text-11 font-bold uppercase tracking-7 text-fg-muted hover:text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
          >
            <Trans>CLEAR ALL</Trans>
          </button>
        </div>
      )}
    </div>
  );
}
