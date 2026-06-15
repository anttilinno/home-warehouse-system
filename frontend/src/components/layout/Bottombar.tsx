import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useShortcutsContext } from "@/components/shortcuts";
import { useModalStack } from "@/components/modal";
import { Window } from "@/components/retro";
import { ShortcutChip } from "./ShortcutChip";
import { Clock } from "./Clock";

export interface BottombarProps {
  /** Open the F1 keyboard-shortcuts help dialog (BAR-05). */
  onOpenHelp: () => void;
  /** Optional ESC/back affordance for the BACK chip. */
  onBack?: () => void;
}

/**
 * Above this many route chips, the route shortcuts collapse behind a single
 * "⋯ MORE" keycap that opens an upward sheet (UI-SPEC §Overflow strategy —
 * sheet, not paginate). F1/ESC and the clocks stay pinned to the right cluster
 * outside the collapse zone (Success Criterion 5). The exact pixel-fit overflow
 * is a Plan 06 viewport concern; this count threshold gives a deterministic,
 * JSDOM-testable collapse trigger that keeps the right cluster intact.
 */
const OVERFLOW_THRESHOLD = 6;

/**
 * The desktop function-key Bottombar (BAR-01, BAR-04, desktop-only — D-06).
 *
 * Renders one {@link ShortcutChip} per merged shortcut from the
 * {@link useShortcutsContext} SSOT (D-08), a `flex-1` spacer, then the
 * right-anchored cluster: an F1 HELP chip (→ `onOpenHelp`), an ESC BACK chip
 * (→ `onBack`), and the SESSION/LOCAL {@link Clock}.
 *
 * It owns NO document letter-keydown listener — the ShortcutsProvider (Plan
 * 03-01) is the single dispatcher (Pitfall 2). The Bottombar is render-only for
 * letters; chip clicks invoke the same `action` closures the provider fires.
 *
 * Desktop-only via `hidden md:flex` (D-06); the FAB is the <768px counterpart.
 */
export function Bottombar({ onOpenHelp, onBack }: BottombarProps) {
  const { shortcuts } = useShortcutsContext();
  const [sheetOpen, setSheetOpen] = useState(false);

  const overflowing = shortcuts.length > OVERFLOW_THRESHOLD;
  // When overflowing, keep the first (THRESHOLD - 1) inline and stash the rest
  // behind the MORE sheet, so the MORE chip itself takes the last inline slot.
  const inlineCount = overflowing ? OVERFLOW_THRESHOLD - 1 : shortcuts.length;
  const inlineShortcuts = shortcuts.slice(0, inlineCount);
  const overflowShortcuts = shortcuts.slice(inlineCount);

  return (
    <footer
      aria-label="Shortcuts"
      className="hidden md:flex h-9 min-w-0 items-center gap-sp-2 overflow-hidden border-t-2 border-border-ink bg-bg-panel-2 px-sp-3"
    >
      {inlineShortcuts.map((s, i) => (
        <ShortcutChip
          key={`${s.key}-${i}`}
          shortcutKey={s.key}
          // Inline route chips stay bare (keycap only); the action name rides in
          // the hover tooltip instead. The full label still shows in the F1 help
          // dialog + the MORE overflow sheet.
          label=""
          title={s.label}
          danger={s.danger}
          onActivate={s.action}
        />
      ))}

      {overflowing && (
        <ShortcutChip
          shortcutKey="⋯"
          label="More"
          onActivate={() => setSheetOpen(true)}
        />
      )}

      {/* Spacer pushes the right cluster to the far edge; it never overflows. */}
      <span className="flex-1" />

      <div className="flex flex-none items-center gap-sp-2">
        <ShortcutChip shortcutKey="F1" label="Help" onActivate={onOpenHelp} />
        <ShortcutChip
          shortcutKey="ESC"
          label="Back"
          onActivate={() => onBack?.()}
        />
        {/* SESSION/LOCAL clock is decorative chrome (~225px) — hidden below lg
            so the bottombar never overflows the content column at md (POL-05). */}
        <span className="hidden lg:inline-flex">
          <Clock />
        </span>
      </div>

      {sheetOpen && (
        <OverflowSheet
          shortcuts={overflowShortcuts}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </footer>
  );
}

/**
 * The upward overflow sheet — a blue-titlebar Window over a scrim listing the
 * overflowed route chips as full keycap rows. ESC closes it via the modal stack
 * (reusing the F1 dialog's overlay machinery — one overlay primitive). Selecting
 * a chip runs its action then closes.
 */
function OverflowSheet({
  shortcuts,
  onClose,
}: {
  shortcuts: {
    key: string;
    label: string;
    action: () => void;
    danger?: boolean;
  }[];
  onClose: () => void;
}) {
  useModalStack(true, onClose);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-end bg-fg-ink/40 p-sp-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More shortcuts"
        className="w-[min(360px,92vw)]"
        onClick={(e) => e.stopPropagation()}
      >
        <Window title={<Trans>MORE SHORTCUTS</Trans>} titlebarVariant="blue">
          <ul className="flex flex-col gap-sp-2">
            {shortcuts.map((s, i) => (
              <li key={`${s.key}-${i}`}>
                <ShortcutChip
                  shortcutKey={s.key}
                  label={s.label}
                  danger={s.danger}
                  onActivate={() => {
                    s.action();
                    onClose();
                  }}
                />
              </li>
            ))}
          </ul>
        </Window>
      </div>
    </div>
  );
}
