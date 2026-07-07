import type { Shortcut } from "@/components/shortcuts";

export interface ShortcutChipProps {
  /** The shortcut key (`"N"`, `"F1"`) — rendered in the inset glyph cell and
   *  surfaced to AT via `aria-keyshortcuts`. Mirrors {@link Shortcut.key}. */
  shortcutKey: Shortcut["key"];
  /** Uppercased-by-CSS label (`"NEW"`). Mirrors {@link Shortcut.label}. */
  label: Shortcut["label"];
  /** Fires the bound shortcut action. */
  onActivate: Shortcut["action"];
  /** Destructive styling (`bg-danger-bg text-danger`). Mirrors {@link Shortcut.danger}. */
  danger?: Shortcut["danger"];
  /** The current/focused chip gets the blue accent face. */
  current?: boolean;
  /** Native hover tooltip; falls back to `label` when omitted. Lets a bare
   *  keycap (empty `label`) still explain itself on hover (e.g. Bottombar N/S/L). */
  title?: string;
  /** Extra classes on the label span — e.g. `"hidden lg:inline"` to reveal the
   *  label only where there's room (Bottombar inline chips). */
  labelClassName?: string;
}

// Face colors are mutually exclusive: danger wins, then current, else panel.
function faceClass(danger?: boolean, current?: boolean): string {
  if (danger) return "bg-danger-bg text-danger";
  if (current) return "bg-titlebar-blue text-fg-ink";
  return "bg-bg-panel text-fg-ink";
}

/**
 * The retro System-7 key-cap chip (BAR-04). One component reused by the
 * Bottombar and the F1 help dialog so the `[KEY] LABEL` treatment stays
 * visually identical across surfaces.
 *
 * Chrome is the UI-SPEC §"Key-cap chip" contract: 2px ink border,
 * `bevel-raised-ink`, the BevelButton press idiom, an inset Plex Mono glyph
 * cell, and a Plex Sans uppercase label. No Silkscreen (Pitfall 6 / hard
 * rule 1) and no raw hex — Phase 2 token utilities only.
 */
export function ShortcutChip({
  shortcutKey,
  label,
  onActivate,
  danger,
  current,
  title,
  labelClassName = "",
}: Readonly<ShortcutChipProps>) {
  // One source for the human-readable purpose: an explicit `title`, else the
  // visible `label`. Drives BOTH the hover tooltip AND the accessible name, so a
  // bare keycap (empty label) still announces "New" rather than just "N".
  const purpose = title ?? (label || undefined);
  return (
    <button
      type="button"
      aria-keyshortcuts={shortcutKey}
      aria-label={purpose}
      title={purpose}
      onClick={onActivate}
      className={`inline-flex cursor-pointer items-center gap-sp-1 border-2 border-border-ink px-sp-2 py-[2px] bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-ink ${faceClass(
        danger,
        current,
      )}`}
    >
      <span className="inline-flex items-center justify-center border border-border-ink bg-bg-panel-2 px-1 font-mono text-12 font-semibold">
        {shortcutKey}
      </span>
      <span
        className={`font-body text-11 font-bold uppercase tracking-10 ${labelClassName}`}
      >
        {label}
      </span>
    </button>
  );
}
