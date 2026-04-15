import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import { HazardStripe } from "./HazardStripe";

interface RetroDialogProps {
  onClose?: () => void;
  hideHazardStripe?: boolean;
  children: ReactNode;
}

export interface RetroDialogHandle {
  open: () => void;
  close: () => void;
}

const RetroDialog = forwardRef<RetroDialogHandle, RetroDialogProps>(
  ({ onClose, hideHazardStripe, children }, ref) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useImperativeHandle(ref, () => ({
      open: () => dialogRef.current?.showModal(),
      close: () => dialogRef.current?.close(),
    }));

    return (
      <dialog
        ref={dialogRef}
        className="bg-retro-cream border-retro-extra-thick border-retro-ink shadow-retro-raised p-0 max-w-[480px] w-full backdrop:bg-black/50"
        onClose={onClose}
      >
        <div className="relative p-lg pt-md">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="absolute top-sm right-sm w-[24px] h-[24px] bg-retro-red border-retro-thick border-retro-ink flex items-center justify-center text-white text-[12px] font-bold leading-none cursor-pointer hover:brightness-110"
          >
            X
          </button>
          {!hideHazardStripe && <HazardStripe className="mb-md" />}
          {children}
        </div>
      </dialog>
    );
  }
);

RetroDialog.displayName = "RetroDialog";

export { RetroDialog };
export type { RetroDialogProps };
