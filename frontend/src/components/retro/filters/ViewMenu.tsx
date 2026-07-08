import { useMemo, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { BevelButton, PixelIcon, RetroCheckbox, RetroInput } from "..";
import { Popover, RetroConfirmDialog, RetroDialog } from "../overlay";
import type { FilterDef } from "./filterDefs";
import type { FilterState } from "./useUrlFilterState";
import type { SavedView } from "./useSavedViews";
import { ALL_VIEW_ID } from "./useSavedViews";

export interface ViewMenuProps {
  defs: FilterDef[];
  filters: FilterState;
  views: SavedView[];
  activeViewId: string;
  isDirty: boolean;
  /** Display name of the active view (falls back to allViewName when on ALL). */
  activeViewName: string;
  /** Label for the synthetic default view row (e.g. "All items"). */
  allViewName: string;
  onApplyView: (view: SavedView) => void;
  onApplyAll: () => void;
  onSaveAs: (name: string) => void;
  onUpdateActive: () => void;
  onDeleteView: (id: string) => void;
}

/** A single boolean/enum-option toggle row (checkbox chrome; keeps menu open). */
function ToggleRow({
  label,
  checked,
  depth = 0,
  onToggle,
}: Readonly<{
  label: React.ReactNode;
  checked: boolean;
  depth?: number;
  onToggle: (checked: boolean) => void;
}>) {
  return (
    <div
      className="px-sp-2 py-[3px]"
      style={depth ? { paddingLeft: 8 + depth * 14 } : undefined}
    >
      <RetroCheckbox
        label={label}
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
      />
    </div>
  );
}

/** The expandable Category (enum) filter row: ▸/▾ header + mini-filter + list. */
function EnumFilterRow({
  def,
  filters,
}: Readonly<{
  def: Extract<FilterDef, { kind: "enum" }>;
  filters: FilterState;
}>) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = filters.values[def.key] ?? [];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return def.options;
    return def.options.filter((o) => o.label.toLowerCase().includes(q));
  }, [def.options, query]);
  const filtering = query.trim() !== "";

  function pick(value: string, checked: boolean) {
    if (def.multi) {
      filters.set(
        def.key,
        checked ? [...selected, value] : selected.filter((v) => v !== value),
      );
    } else {
      filters.set(def.key, checked ? [value] : []);
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-sp-1 px-sp-2 py-[4px] text-left text-14 text-fg-ink hover:bg-titlebar-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
      >
        <PixelIcon name={open ? "chevron-down" : "chevron-right"} size={14} />
        <span className="flex-1">{def.label}</span>
        {selected.length > 0 && (
          <span className="font-mono text-11 text-fg-muted">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <div className="pb-sp-1">
          <div className="px-sp-2 py-sp-1">
            <input
              type="search"
              aria-label={t`Filter categories`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t`Filter categories…`}
              className="w-full border-2 border-border-ink bg-bg-panel px-[8px] py-[4px] text-12 text-fg-ink bevel-sunken focus:outline-2 focus:outline-offset-1 focus:outline-titlebar-blue"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {shown.length === 0 ? (
              <div className="px-sp-2 py-[6px] text-12 text-fg-muted">
                <Trans>NO MATCHES</Trans>
              </div>
            ) : (
              shown.map((opt) => (
                <ToggleRow
                  key={opt.value}
                  label={opt.label}
                  checked={selected.includes(opt.value)}
                  depth={filtering ? 0 : opt.depth}
                  onToggle={(c) => pick(opt.value, c)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The FILTERS section: one enum row (expandable) or boolean toggle per def. */
function FiltersSection({
  defs,
  filters,
}: Readonly<{ defs: FilterDef[]; filters: FilterState }>) {
  return (
    <>
      <div className="px-sp-2 pt-sp-1 pb-px text-10 font-bold uppercase tracking-8 text-fg-muted">
        <Trans>FILTERS</Trans>
      </div>
      {defs.map((def) => {
        if (def.kind === "boolean") {
          const active = (filters.values[def.key] ?? []).length > 0;
          return (
            <ToggleRow
              key={def.key}
              label={def.label}
              checked={active}
              onToggle={(c) => filters.set(def.key, c ? ["1"] : [])}
            />
          );
        }
        return <EnumFilterRow key={def.key} def={def} filters={filters} />;
      })}
    </>
  );
}

/**
 * The single filter/view popover: save/update actions (when dirty) → saved
 * views list (apply / delete) → the FILTERS section (category tree + boolean
 * toggles). Selecting a filter or view mutates state but never closes the menu
 * (except an explicit apply). ESC/tap-outside close via the shared Popover.
 */
export function ViewMenu({
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
}: Readonly<ViewMenuProps>) {
  const { t } = useLingui();
  // Below the sm breakpoint the menu renders as a bottom sheet, not an anchored
  // popover — the tall filters/views list needs the full-width surface.
  const isMobile = useMediaQuery("(max-width: 639px)");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SavedView | null>(null);
  const canUpdate = activeViewId !== ALL_VIEW_ID;

  function submitSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSaveAs(trimmed);
    setName("");
    setSaveOpen(false);
  }

  return (
    <>
      <BevelButton
        ref={triggerRef}
        variant="neutral"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <PixelIcon name="chevron-down" size={16} />
        <span>{activeViewName}</span>
        {isDirty && (
          <span aria-hidden="true" className="text-accent-pink-deep">
            ●
          </span>
        )}
      </BevelButton>

      {/* Discoverable shortcut to the save dialog, only when the current filters
          differ from the active view. Shares the dialog below. */}
      {isDirty && (
        <BevelButton
          variant="mint"
          onClick={() => {
            setMenuOpen(false);
            setSaveOpen(true);
          }}
        >
          <Trans>SAVE</Trans>
        </BevelButton>
      )}

      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={triggerRef}
        role="menu"
        minWidth={240}
        variant={isMobile ? "sheet" : "anchor"}
      >
        {isDirty && (
          <div className="border-b border-table-rule pb-sp-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setSaveOpen(true);
              }}
              className="w-full cursor-pointer px-sp-2 py-[6px] text-left text-14 font-bold text-accent-mint-deep hover:bg-titlebar-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
            >
              <Trans>SAVE CURRENT AS VIEW…</Trans>
            </button>
            {canUpdate && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onUpdateActive();
                  setMenuOpen(false);
                }}
                className="w-full cursor-pointer px-sp-2 py-[6px] text-left text-14 text-fg-ink hover:bg-titlebar-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
              >
                <Trans>UPDATE “{activeViewName}”</Trans>
              </button>
            )}
          </div>
        )}

        <div className="px-sp-2 pt-sp-1 pb-px text-10 font-bold uppercase tracking-8 text-fg-muted">
          <Trans>VIEWS</Trans>
        </div>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onApplyAll();
            setMenuOpen(false);
          }}
          className={`w-full cursor-pointer px-sp-2 py-[6px] text-left text-14 text-fg-ink hover:bg-titlebar-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink ${activeViewId === ALL_VIEW_ID ? "bg-titlebar-blue font-bold" : ""}`}
        >
          {allViewName}
        </button>
        {views.map((view) => (
          <div
            key={view.id}
            className={`flex items-center gap-sp-2 px-sp-2 py-[6px] text-14 text-fg-ink hover:bg-titlebar-blue ${view.id === activeViewId ? "bg-titlebar-blue font-bold" : ""}`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onApplyView(view);
                setMenuOpen(false);
              }}
              className="flex-1 cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
            >
              {view.name}
            </button>
            <button
              type="button"
              aria-label={t`Delete view ${view.name}`}
              title={t`Delete view ${view.name}`}
              onClick={() => setPendingDelete(view)}
              className="flex-none cursor-pointer px-sp-1 text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        ))}

        <div className="my-sp-1 border-t border-table-rule" />
        <FiltersSection defs={defs} filters={filters} />
      </Popover>

      <RetroDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={<Trans>SAVE VIEW</Trans>}
        footer={
          <>
            <BevelButton variant="neutral" onClick={() => setSaveOpen(false)}>
              <Trans>CANCEL</Trans>
            </BevelButton>
            <BevelButton variant="primary" onClick={submitSave}>
              <Trans>SAVE</Trans>
            </BevelButton>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitSave();
          }}
        >
          <RetroInput
            label={t`View name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </form>
      </RetroDialog>

      <RetroConfirmDialog
        open={pendingDelete !== null}
        title={<Trans>DELETE VIEW</Trans>}
        confirmLabel={<Trans>DELETE</Trans>}
        onConfirm={() => {
          if (pendingDelete) onDeleteView(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
        onClose={() => setPendingDelete(null)}
      >
        <Trans>
          Delete the “{pendingDelete?.name}” view? This can't be undone.
        </Trans>
      </RetroConfirmDialog>
    </>
  );
}
