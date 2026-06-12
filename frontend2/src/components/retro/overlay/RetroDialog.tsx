import { useEffect, useId, useRef, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useModalStack } from "@/components/modal";
import { Window, type TitlebarVariant } from "@/components/retro";

export interface RetroDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog requests close (ESC via modal stack, close box, or scrim click). */
  onClose: () => void;
  /** Titlebar title (rendered inside the Window header, wired to aria-labelledby). */
  title: ReactNode;
  /** Semantic titlebar color. Default "blue" (informational). */
  titlebarVariant?: TitlebarVariant;
  /** Extra right-aligned titlebar slot content, rendered before the close box. */
  actions?: ReactNode;
  /** Optional right-aligned footer action row (BevelButtons). */
  footer?: ReactNode;
  /** Width contract. Default min(520px, 92vw). */
  width?: string;
  children: ReactNode;
}

/**
 * Centered-modal retro-os Window over a scrim. Generalizes the proven Phase 3
 * F1HelpDialog overlay recipe:
 * - scrim click + titlebar close box + ESC all route to `onClose`.
 * - ESC flows EXCLUSIVELY through the Phase 3 capture-phase {@link useModalStack}
 *   arbiter — there is NO document-level ESC listener here (TUI-02 LOCKED).
 * - focus is trapped inside the dialog and restored to the invoking control on close.
 */
export function RetroDialog({
  open,
  onClose,
  title,
  titlebarVariant = "blue",
  actions,
  footer,
  width = "min(520px,92vw)",
  children,
}: RetroDialogProps) {
  const { t } = useLingui();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);

  // ESC pops this overlay via the shared modal stack (never logout).
  useModalStack(open, onClose);

  // Focus management: trap inside the dialog on open, restore on close.
  useEffect(() => {
    if (!open) return;
    invokerRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const node = dialogRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node?.addEventListener("keydown", onKeyDown);
    return () => {
      node?.removeEventListener("keydown", onKeyDown);
      invokerRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const closeBox = (
    <button
      type="button"
      aria-label={t`Close`}
      onClick={onClose}
      className="flex h-[14px] w-[14px] flex-none cursor-pointer items-center justify-center border-2 border-border-ink bg-bg-panel text-[10px] leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2"
    >
      <span aria-hidden="true">✕</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-fg-ink/40 p-sp-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="outline-none"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <Window
          title={<span id={titleId}>{title}</span>}
          titlebarVariant={titlebarVariant}
          actions={
            actions ? (
              <span className="flex items-center gap-sp-2">
                {actions}
                {closeBox}
              </span>
            ) : (
              closeBox
            )
          }
        >
          <div className="flex max-h-[70vh] flex-col gap-sp-4 overflow-y-auto">
            {children}
          </div>
          {footer && (
            <div className="mt-sp-4 flex items-center justify-end gap-sp-2 border-t-2 border-border-ink pt-sp-3">
              {footer}
            </div>
          )}
        </Window>
      </div>
    </div>
  );
}
