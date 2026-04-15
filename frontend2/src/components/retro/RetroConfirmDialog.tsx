import {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroDialog, type RetroDialogHandle } from "./RetroDialog";
import { RetroButton } from "./RetroButton";

interface RetroConfirmDialogSecondaryLink {
  label: string;
  onClick: () => void;
}

interface RetroConfirmDialogProps {
  title: string;
  body: ReactNode;
  escapeLabel: string;
  destructiveLabel: string;
  variant: "destructive" | "soft";
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  /** Optional small mono chip rendered below the title (used for soft variant warnings). */
  headerBadge?: string;
  /** Optional small text-button rendered below the primary buttons (e.g. "delete permanently"). */
  secondaryLink?: RetroConfirmDialogSecondaryLink;
}

interface RetroConfirmDialogHandle {
  open: () => void;
  close: () => void;
}

const RetroConfirmDialog = forwardRef<
  RetroConfirmDialogHandle,
  RetroConfirmDialogProps
>(
  (
    {
      title,
      body,
      escapeLabel,
      destructiveLabel,
      variant,
      onConfirm,
      onCancel,
      headerBadge,
      secondaryLink,
    },
    ref
  ) => {
    const { t } = useLingui();
    const innerRef = useRef<RetroDialogHandle>(null);
    const [pending, setPending] = useState(false);
    const titleId = useId();

    useImperativeHandle(ref, () => ({
      open: () => innerRef.current?.open(),
      close: () => innerRef.current?.close(),
    }));

    const handleConfirm = async () => {
      setPending(true);
      try {
        await onConfirm();
        innerRef.current?.close();
      } finally {
        setPending(false);
      }
    };

    const handleCancel = () => {
      onCancel?.();
      innerRef.current?.close();
    };

    const confirmVariant = variant === "destructive" ? "danger" : "primary";

    return (
      <RetroDialog
        ref={innerRef}
        onClose={onCancel}
        hideHazardStripe={variant !== "destructive"}
      >
        <h2
          id={titleId}
          className="text-[20px] font-bold uppercase text-retro-ink mb-sm"
        >
          {title}
        </h2>
        {headerBadge && variant === "soft" && (
          <span
            className="inline-block mb-md px-sm py-xs font-mono text-[12px] uppercase border-retro-thick border-retro-ink"
            style={{ backgroundColor: "var(--color-retro-orange)" }}
          >
            {headerBadge}
          </span>
        )}
        <div className="text-[14px] text-retro-ink mb-lg">{body}</div>
        <div className="flex justify-end gap-sm mt-lg">
          <RetroButton
            variant="neutral"
            onClick={handleCancel}
            disabled={pending}
          >
            {escapeLabel}
          </RetroButton>
          <RetroButton
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? t`WORKING…` : destructiveLabel}
          </RetroButton>
        </div>
        {secondaryLink && (
          <div className="flex justify-end mt-sm">
            <button
              type="button"
              onClick={secondaryLink.onClick}
              disabled={pending}
              className="text-[14px] text-retro-charcoal/70 hover:text-retro-ink underline cursor-pointer disabled:cursor-not-allowed"
            >
              {secondaryLink.label}
            </button>
          </div>
        )}
      </RetroDialog>
    );
  }
);

RetroConfirmDialog.displayName = "RetroConfirmDialog";

export { RetroConfirmDialog };
export type { RetroConfirmDialogProps, RetroConfirmDialogHandle };
