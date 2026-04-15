import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  useFloating,
} from "@floating-ui/react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";

export interface SlideOverPanelProps {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
  isDirty: boolean;
}

export interface SlideOverPanelHandle {
  open: () => void;
  close: () => void;
  closeImmediate: () => void;
}

const SlideOverPanel = forwardRef<SlideOverPanelHandle, SlideOverPanelProps>(
  function SlideOverPanel(
    { title, children, footer, onClose, isDirty },
    ref,
  ) {
    const { t } = useLingui();
    const [open, setOpen] = useState(false);
    const titleId = useId();
    const discardRef = useRef<RetroConfirmDialogHandle>(null);
    const { refs, context } = useFloating({
      open,
      onOpenChange: setOpen,
    });

    const closeImmediate = useCallback(() => {
      setOpen(false);
      onClose();
    }, [onClose]);

    const attemptClose = useCallback(() => {
      if (isDirty) {
        discardRef.current?.open();
        return;
      }
      closeImmediate();
    }, [isDirty, closeImmediate]);

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => attemptClose(),
      closeImmediate,
    }));

    // Esc key handler
    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          attemptClose();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [open, attemptClose]);

    if (!open) return null;

    return (
      <FloatingPortal>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-retro-charcoal/40 z-40"
          onClick={attemptClose}
          aria-hidden="true"
        />
        <FloatingFocusManager context={context} initialFocus={0}>
          <div
            ref={refs.setFloating}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{
              transform: open ? "translateX(0)" : "translateX(100%)",
            }}
            className="fixed top-0 right-0 h-dvh w-full sm:w-[60vw] sm:min-w-[360px] lg:w-[480px] bg-retro-cream border-l-retro-thick border-retro-ink shadow-retro-raised z-50 flex flex-col transform transition-transform duration-150 ease-out motion-reduce:transition-none"
          >
            <div className="flex items-center justify-between p-md border-b-retro-thick border-retro-ink">
              <h2
                id={titleId}
                className="text-[20px] font-bold uppercase text-retro-ink"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={attemptClose}
                aria-label={t`Close panel`}
                className="min-h-[44px] min-w-[44px] bg-retro-red border-retro-thick border-retro-ink flex items-center justify-center text-white text-[18px] font-bold leading-none cursor-pointer hover:brightness-110"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-md">{children}</div>
            <div className="sticky bottom-0 p-md border-t-retro-thick border-retro-ink bg-retro-cream flex gap-sm justify-end">
              {footer}
            </div>
          </div>
        </FloatingFocusManager>
        <RetroConfirmDialog
          ref={discardRef}
          variant="destructive"
          title={t`DISCARD CHANGES?`}
          body={t`Your edits will be lost.`}
          escapeLabel={t`← BACK`}
          destructiveLabel={t`DISCARD`}
          onConfirm={() => {
            closeImmediate();
          }}
        />
      </FloatingPortal>
    );
  },
);

SlideOverPanel.displayName = "SlideOverPanel";

export { SlideOverPanel };
