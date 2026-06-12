import { useState, type ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BevelButton, RetroBadge } from "@/components/retro";
import { RetroConfirmDialog } from "../overlay";

/** A destructive bulk action that must route through a confirm dialog. */
export interface DestructiveBulkAction {
  /** Confirm-button + trigger label (the verb, e.g. "DELETE"). */
  label: ReactNode;
  /** Confirm dialog titlebar title. */
  confirmTitle: ReactNode;
  /** Confirm dialog body sentence. */
  confirmBody: ReactNode;
  /** Invoked only after the confirm dialog is accepted. */
  onConfirm: () => void;
}

export interface BulkActionBarProps {
  /** Number of selected rows (the `{n} SELECTED` count). */
  selectedCount: number;
  /** Deselect-all handler. */
  onClear: () => void;
  /** Non-destructive action BevelButtons. */
  children?: ReactNode;
  /** Optional destructive action, routed through RetroConfirmDialog. */
  destructiveAction?: DestructiveBulkAction;
  className?: string;
}

/**
 * The inline mobile/contextual bulk-selection surface, per UI-SPEC. Desktop
 * bulk actions surface via the Phase 3 Bottombar (SSOT — this atom is NOT a
 * second desktop bar); BulkActionBar renders where there is no Bottombar.
 * `role="toolbar"` with a polite-live `{n} SELECTED` count; destructive actions
 * route through RetroConfirmDialog (pink, focus-on-cancel) before executing.
 */
export function BulkActionBar({
  selectedCount,
  onClear,
  children,
  destructiveAction,
  className = "",
}: BulkActionBarProps) {
  const { t } = useLingui();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div
      role="toolbar"
      aria-label={t`Bulk actions`}
      className={`flex items-center gap-sp-2 border-2 border-border-ink bg-bg-panel-2 p-sp-3 bevel-raised ${className}`}
    >
      <span aria-live="polite" className="font-mono text-[12px] tabular-nums">
        <RetroBadge className="bg-titlebar-blue">
          {selectedCount} <Trans>SELECTED</Trans>
        </RetroBadge>
      </span>

      {children}

      {destructiveAction && (
        <BevelButton
          variant="danger"
          onClick={() => setConfirmOpen(true)}
        >
          {destructiveAction.label}
        </BevelButton>
      )}

      <span className="flex-1" />

      <BevelButton variant="neutral" onClick={onClear}>
        <Trans>✕ CLEAR</Trans>
      </BevelButton>

      {destructiveAction && (
        <RetroConfirmDialog
          open={confirmOpen}
          title={destructiveAction.confirmTitle}
          confirmLabel={destructiveAction.label}
          onConfirm={() => {
            destructiveAction.onConfirm();
            setConfirmOpen(false);
          }}
          onCancel={() => setConfirmOpen(false)}
          onClose={() => setConfirmOpen(false)}
        >
          {destructiveAction.confirmBody}
        </RetroConfirmDialog>
      )}
    </div>
  );
}
