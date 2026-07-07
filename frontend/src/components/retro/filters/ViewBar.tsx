import { type ReactNode, useMemo } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { FilterDef } from "./filterDefs";
import type { FilterState } from "./useUrlFilterState";
import type { SavedView } from "./useSavedViews";
import { TokenField, type FieldToken } from "./TokenField";
import { ViewMenu } from "./ViewMenu";

export interface ViewBarProps {
  defs: FilterDef[];
  filters: FilterState;
  views: SavedView[];
  activeViewId: string;
  isDirty: boolean;
  activeViewName: string;
  allViewName: string;
  onApplyView: (view: SavedView) => void;
  onApplyAll: () => void;
  onSaveAs: (name: string) => void;
  onUpdateActive: () => void;
  onDeleteView: (id: string) => void;
  /** The LIVE search value (`q`) + its setter. */
  liveValue: string;
  onLiveChange: (value: string) => void;
  itemCount: number;
  primaryAction?: ReactNode;
  searchPlaceholder?: string;
}

/**
 * The single filtering toolbar (design 1c) — replaces the SavedFilters row +
 * FilterBar + chip row with one surface: a ViewMenu (saved views + filters), a
 * TokenField (active filters + committed terms as removable chips + a live
 * search input), a mono `{n} items` count, and a primary-action slot. Generic
 * over `FilterDef[]`, so any list page adopts it by supplying its own defs +
 * saved-views storage.
 */
export function ViewBar({
  defs,
  filters,
  views,
  activeViewId,
  isDirty,
  activeViewName,
  allViewName,
  onApplyView,
  onApplyAll,
  onSaveAs,
  onUpdateActive,
  onDeleteView,
  liveValue,
  onLiveChange,
  itemCount,
  primaryAction,
  searchPlaceholder,
}: Readonly<ViewBarProps>) {
  const { t } = useLingui();

  // Every active def filter + committed term becomes a removable token. Def
  // chips remove via clear(key); terms remove via removeTerm(term).
  const tokens = useMemo<FieldToken[]>(() => {
    const defTokens: FieldToken[] = filters.chips.map((chip) => ({
      key: chip.key,
      label: chip.label,
      displayValue: chip.displayValue,
      onRemove: () => filters.clear(chip.key),
    }));
    const termTokens: FieldToken[] = filters.terms.map((term) => ({
      key: `term:${term}`,
      label: t`Search`,
      displayValue: term,
      onRemove: () => filters.removeTerm(term),
    }));
    return [...defTokens, ...termTokens];
  }, [filters, t]);

  return (
    <div className="flex flex-wrap items-center gap-sp-2 bg-bg-panel-2 p-sp-3">
      <ViewMenu
        defs={defs}
        filters={filters}
        views={views}
        activeViewId={activeViewId}
        isDirty={isDirty}
        activeViewName={activeViewName}
        allViewName={allViewName}
        onApplyView={onApplyView}
        onApplyAll={onApplyAll}
        onSaveAs={onSaveAs}
        onUpdateActive={onUpdateActive}
        onDeleteView={onDeleteView}
      />

      <TokenField
        className="min-w-[280px] flex-1"
        tokens={tokens}
        value={liveValue}
        onChange={onLiveChange}
        onCommit={filters.commitTerm}
        onClearAll={filters.clearAll}
        onBackspaceEmpty={() => {
          const last = tokens[tokens.length - 1];
          last?.onRemove();
        }}
        placeholder={searchPlaceholder}
      />

      <span className="font-mono text-12 tabular-nums text-fg-muted">
        {itemCount} <Trans>items</Trans>
      </span>

      {primaryAction}
    </div>
  );
}
