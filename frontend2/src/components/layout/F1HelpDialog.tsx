import { useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { useShortcutsContext, type Shortcut } from "@/components/shortcuts";
import { RetroDialog } from "@/components/retro";
import { ShortcutChip } from "./ShortcutChip";

export interface F1HelpDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog requests close (ESC via modal stack, or F1 toggle while open). */
  onClose: () => void;
  /** Called by the single F1/"?" keydown owner to toggle the dialog. */
  onToggle: () => void;
}

/** Synthetic Global-scope rows the help dialog always documents. */
const GLOBAL_SYNTHETIC: { shortcutKey: string; description: string }[] = [
  { shortcutKey: "F1", description: "Toggle this help" },
  { shortcutKey: "ESC", description: "Close / back" },
];

/**
 * The F1 keyboard-shortcuts help dialog (BAR-05, TUI-01/02).
 *
 * Owns the SINGLE F1 (and "?") keydown listener that toggles the dialog
 * (mirrors the legacy `use-keyboard-shortcuts-dialog`; exactly one owner,
 * cleaned up on unmount — Pitfall 2). When open it renders a blue-titlebar
 * {@link RetroDialog} ("KEYBOARD SHORTCUTS"), lists the merged
 * {@link useShortcutsContext} shortcuts grouped by scope (Global, then route).
 * RetroDialog supplies the scrim, focus-trap, invoker focus-restore, and the
 * modal-stack ESC pop (never logout — TUI-02); this component only owns the F1
 * toggle listener (the F1 owner, NOT an ESC listener).
 */
export function F1HelpDialog({ open, onClose, onToggle }: F1HelpDialogProps) {
  const { shortcuts } = useShortcutsContext();

  // The SINGLE F1/"?" toggle owner. Bails on modifier combos and editable
  // surfaces so it never fires while typing. (NOT an ESC listener — ESC is
  // owned by RetroDialog's useModalStack.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "F1" && e.key !== "?") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      onToggle();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onToggle]);

  // Route shortcuts = the merged SSOT (F1/ESC live in the synthetic Global group).
  const routeShortcuts: Shortcut[] = shortcuts;

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={<Trans>KEYBOARD SHORTCUTS</Trans>}
      titlebarVariant="blue"
    >
      <Group label={<Trans>GLOBAL</Trans>}>
        {GLOBAL_SYNTHETIC.map((row) => (
          <Row
            key={row.shortcutKey}
            shortcutKey={row.shortcutKey}
            label={row.shortcutKey}
            onActivate={() => {}}
            description={row.description}
          />
        ))}
      </Group>

      <Group label={<Trans>ROUTE</Trans>}>
        {routeShortcuts.length === 0 ? (
          <div className="flex flex-col gap-sp-1">
            <p className="font-body text-[13px] font-semibold uppercase tracking-[0.1em] text-fg-ink">
              <Trans>NO SHORTCUTS HERE</Trans>
            </p>
            <p className="font-body text-[14px] text-fg-muted">
              <Trans>
                This route has no quick actions yet. Press F1 anytime for the
                full list.
              </Trans>
            </p>
          </div>
        ) : (
          routeShortcuts.map((s, i) => (
            <Row
              key={`${s.key}-${i}`}
              shortcutKey={s.key}
              label={s.label}
              danger={s.danger}
              onActivate={() => {
                s.action();
                onClose();
              }}
              description={s.label}
            />
          ))
        )}
      </Group>
    </RetroDialog>
  );
}

function Group({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-sp-2">
      <h3 className="border-b border-dotted border-fg-faint pb-[3px] font-body text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
        {label}
      </h3>
      <div className="flex flex-col gap-sp-1">{children}</div>
    </section>
  );
}

function Row({
  shortcutKey,
  label,
  description,
  danger,
  onActivate,
}: {
  shortcutKey: string;
  label: string;
  description: string;
  danger?: boolean;
  onActivate: () => void;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-sp-3 py-[3px]">
      <ShortcutChip
        shortcutKey={shortcutKey}
        label={label}
        danger={danger}
        onActivate={onActivate}
      />
      <span className="font-body text-[14px] text-fg-ink">{description}</span>
    </div>
  );
}
