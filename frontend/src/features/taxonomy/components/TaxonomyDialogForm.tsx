import { type FormEventHandler, type ReactNode, useState } from "react";
import { Trans } from "@lingui/react/macro";
import {
  BevelButton,
  RetroConfirmDialog,
  RetroDialog,
} from "@/components/retro";

// Shared scaffold for the taxonomy CRUD form dialogs (TAX refactor — extracted
// from the Location/Container/Label inline dialogs, which were byte-for-byte
// clones of the RetroDialog shell + root-error alert + footer + dirty-close
// guard). The owning dialog keeps its own RHF + zod + field markup and passes
// the pre-wrapped submit handler in; this component owns ONLY the chrome and the
// confirmDiscard state. Behavior is identical to the hand-rolled scaffolds.

// FormRootError renders the RHF root error alert (shared by all four taxonomy
// form dialogs, including the routed CategoryFormDialog).
export function FormRootError({ message }: Readonly<{ message?: string }>) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-2 border-border-ink bg-danger-bg p-sp-3 text-14 text-danger"
    >
      <span aria-hidden="true">✕ </span>
      {message}
    </div>
  );
}

// DiscardChangesDialog is the butter "DISCARD CHANGES?" confirm shared by every
// taxonomy form's dirty-close/leave guard. The owner supplies the open flag and
// the confirm/cancel wiring (inline dialogs close; the routed form navigates).
export function DiscardChangesDialog({
  open,
  onConfirm,
  onCancel,
}: Readonly<{
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  return (
    <RetroConfirmDialog
      open={open}
      title={<Trans>DISCARD CHANGES?</Trans>}
      titlebarVariant="butter"
      confirmVariant="neutral"
      confirmLabel={<Trans>Discard</Trans>}
      cancelLabel={<Trans>Keep editing</Trans>}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClose={onCancel}
    >
      <Trans>Your edits will be lost.</Trans>
    </RetroConfirmDialog>
  );
}

export interface TaxonomyDialogFormProps {
  open: boolean;
  title: string;
  submitLabel: string;
  isSubmitting: boolean;
  isDirty: boolean;
  rootError?: string;
  /** Pre-wrapped RHF submit handler: handleSubmit(onSubmit). */
  onSubmit: FormEventHandler<HTMLFormElement>;
  /** Confirmed close (only fired when the form is clean or the user discards). */
  onClose: () => void;
  /** The form fields. */
  children: ReactNode;
}

// TaxonomyDialogForm wraps an inline taxonomy CRUD form in the standard blue
// RetroDialog with a root-error slot, the field children, the Cancel/Submit
// footer, and the dirty-close discard guard. Closing a dirty form opens the
// butter discard confirm before calling onClose.
export function TaxonomyDialogForm({
  open,
  title,
  submitLabel,
  isSubmitting,
  isDirty,
  rootError,
  onSubmit,
  onClose,
  children,
}: Readonly<TaxonomyDialogFormProps>) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function attemptClose() {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }

  return (
    <>
      <RetroDialog
        open={open}
        onClose={attemptClose}
        title={title}
        titlebarVariant="blue"
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-sp-4">
          <FormRootError message={rootError} />

          {children}

          <div className="flex justify-end gap-sp-2 border-t-2 border-border-ink pt-sp-3">
            <BevelButton type="button" variant="neutral" onClick={attemptClose}>
              <Trans>Cancel</Trans>
            </BevelButton>
            <BevelButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {submitLabel}
            </BevelButton>
          </div>
        </form>
      </RetroDialog>

      <DiscardChangesDialog
        open={confirmDiscard}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
