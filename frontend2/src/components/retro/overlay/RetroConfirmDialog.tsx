import { useEffect, useRef, type ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { BevelButton, type BevelButtonVariant, type TitlebarVariant } from "@/components/retro";
import { RetroDialog } from "./RetroDialog";

export interface RetroConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Titlebar title. */
  title: ReactNode;
  /** Confirm-button label (the destructive/decision verb, consumer-named). */
  confirmLabel: ReactNode;
  /** Cancel-button label. Defaults to a translated "Cancel". */
  cancelLabel?: ReactNode;
  /** Called when the confirm action is activated. */
  onConfirm: () => void;
  /** Called when the cancel button is activated. */
  onCancel: () => void;
  /**
   * Called when the dialog requests close (ESC / scrim / close box). Usually
   * the same handler as onCancel.
   */
  onClose: () => void;
  /** Titlebar color. Default "pink" (danger semantic). "butter" for non-destructive decisions. */
  titlebarVariant?: TitlebarVariant;
  /** Confirm BevelButton variant. Default "danger". Use "neutral"/"primary"/"mint" for non-destructive. */
  confirmVariant?: BevelButtonVariant;
  /** Body copy (the confirm sentence; pass an extra text-danger consequence line as children). */
  children: ReactNode;
}

/**
 * A {@link RetroDialog} preset for destructive/decision confirms (CONTEXT).
 * Pink titlebar + danger confirm by default; focus defaults to Cancel (safe
 * default) so Enter cancels and the destructive action requires an explicit
 * confirm-button activation. Non-destructive decisions ("Discard changes?")
 * pass `titlebarVariant="butter"` + a neutral `confirmVariant`.
 */
export function RetroConfirmDialog({
  open,
  title,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  onClose,
  titlebarVariant = "pink",
  confirmVariant = "danger",
  children,
}: RetroConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Autofocus Cancel after the dialog mounts (RetroDialog focuses the dialog
  // node on open; we then move focus to the safe default).
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={title}
      titlebarVariant={titlebarVariant}
      width="min(420px,92vw)"
      footer={
        <>
          <BevelButton ref={cancelRef} variant="neutral" onClick={onCancel}>
            {cancelLabel ?? <Trans>Cancel</Trans>}
          </BevelButton>
          <BevelButton variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </BevelButton>
        </>
      }
    >
      <p className="font-body text-[14px] text-fg-ink">{children}</p>
    </RetroDialog>
  );
}
