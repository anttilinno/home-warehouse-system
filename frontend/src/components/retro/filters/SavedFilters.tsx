import { useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BevelButton, RetroInput } from "@/components/retro";
import { Popover, RetroConfirmDialog, RetroDialog } from "../overlay";
import type { SavedFilter } from "./useSavedFilters";

export interface SavedFiltersProps {
  /** The persisted presets (from useSavedFilters). */
  savedFilters: SavedFilter[];
  /** The currently-applied preset id (its chip renders active / aria-pressed). */
  activeId?: string;
  /** Apply a preset by id. */
  onApply: (id: string) => void;
  /** Delete a preset by id (called only after the confirm dialog is accepted). */
  onDelete: (id: string) => void;
  /** Persist the current FilterBar state under a new name. */
  onSaveCurrent: (name: string) => void;
  className?: string;
}

/**
 * Preset chips + a `▾ PRESETS` menu, per UI-SPEC. Active preset chip =
 * `bg-titlebar-blue` + `aria-pressed`. The menu (Plan 04-01 chromeless Popover)
 * lists presets with a per-preset delete (→ RetroConfirmDialog) plus a
 * `SAVE CURRENT…` item that opens a small RetroDialog name field. All preset
 * names render as TEXT nodes (JSX auto-escape — never raw-HTML injection).
 * ESC closes the menu/dialogs exclusively via the shared modal stack.
 */
export function SavedFilters({
  savedFilters,
  activeId,
  onApply,
  onDelete,
  onSaveCurrent,
  className = "",
}: SavedFiltersProps) {
  const { t } = useLingui();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SavedFilter | null>(null);

  function submitSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSaveCurrent(trimmed);
    setName("");
    setSaveOpen(false);
  }

  return (
    <div className={`flex items-center gap-sp-1 ${className}`}>
      {/* Preset chips (RetroBadge chrome via button; active = blue). */}
      {savedFilters.map((preset) => {
        const active = preset.id === activeId;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            onClick={() => onApply(preset.id)}
            className={`inline-flex items-center gap-[6px] rounded-chip border border-border-ink px-sp-2 py-px text-[11px] font-bold uppercase tracking-[0.07em] text-fg-ink cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2 ${
              active ? "bg-titlebar-blue" : "bg-bg-panel-2"
            }`}
          >
            {preset.name}
          </button>
        );
      })}

      {/* ▾ PRESETS trigger + menu. */}
      <BevelButton
        ref={triggerRef}
        variant="neutral"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <Trans>▾ PRESETS</Trans>
      </BevelButton>

      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={triggerRef}
        role="menu"
        minWidth={200}
      >
        {savedFilters.length === 0 ? (
          <div
            role="menuitem"
            className="px-sp-2 py-[6px] text-[14px] text-fg-muted"
          >
            <Trans>No saved filters yet.</Trans>
          </div>
        ) : (
          savedFilters.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center gap-sp-2 px-sp-2 py-[6px] text-[14px] text-fg-ink hover:bg-titlebar-blue"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onApply(preset.id);
                  setMenuOpen(false);
                }}
                className="flex-1 cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
              >
                {preset.name}
              </button>
              <button
                type="button"
                aria-label={t`Delete preset ${preset.name}`}
                title={t`Delete preset ${preset.name}`}
                onClick={() => {
                  setPendingDelete(preset);
                  setMenuOpen(false);
                }}
                className="flex-none cursor-pointer px-sp-1 text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          ))
        )}

        <div className="my-sp-1 border-t border-table-rule" />
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setMenuOpen(false);
            setSaveOpen(true);
          }}
          className="cursor-pointer px-sp-2 py-[6px] text-left text-[14px] text-fg-ink hover:bg-titlebar-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
        >
          <Trans>SAVE CURRENT…</Trans>
        </button>
      </Popover>

      {/* SAVE CURRENT… name dialog. */}
      <RetroDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={<Trans>SAVE FILTER</Trans>}
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
            label={t`Preset name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </form>
      </RetroDialog>

      {/* Per-preset delete confirm. */}
      <RetroConfirmDialog
        open={pendingDelete !== null}
        title={<Trans>DELETE PRESET</Trans>}
        confirmLabel={<Trans>DELETE</Trans>}
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
        onClose={() => setPendingDelete(null)}
      >
        <Trans>
          Delete the “{pendingDelete?.name}” preset? This can't be undone.
        </Trans>
      </RetroConfirmDialog>
    </div>
  );
}
