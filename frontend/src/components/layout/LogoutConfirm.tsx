import { Trans } from "@lingui/react/macro";
import { BevelButton } from "@/components/retro";
import { useModalStack } from "@/components/modal";

export interface LogoutConfirmProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirm-before-logout dialog (BAR-05). Shared by the TopBar account menu AND
// the Sidebar user menu so logout is NEVER reachable in one click and ESC always
// closes THIS dialog (it pushes onto the modal stack) rather than logging out.
export function LogoutConfirm({
  open,
  onCancel,
  onConfirm,
}: LogoutConfirmProps) {
  useModalStack(open, onCancel);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-fg-ink/40"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-[min(420px,92vw)] border-2 border-border-ink bg-bg-panel bevel-raised"
      >
        <header className="border-b-2 border-border-ink bg-titlebar-pink px-sp-3 py-[6px] pinstripes">
          <h2
            id="logout-confirm-title"
            className="text-center font-display text-16 uppercase tracking-2"
          >
            <Trans>Log out</Trans>
          </h2>
        </header>
        <div className="p-sp-4">
          <p className="text-14 text-fg-ink">
            <Trans>End this session? You will need to sign in again.</Trans>
          </p>
          <div className="mt-sp-4 flex justify-end gap-sp-2">
            <BevelButton onClick={onCancel}>
              <Trans>Stay</Trans>
            </BevelButton>
            <BevelButton variant="danger" onClick={onConfirm}>
              <Trans>Log out</Trans>
            </BevelButton>
          </div>
        </div>
      </div>
    </div>
  );
}
