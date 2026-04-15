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

interface RetroConfirmDialogProps {
  title: string;
  body: ReactNode;
  escapeLabel: string;
  destructiveLabel: string;
  variant: "destructive" | "soft";
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
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
    { title, body, escapeLabel, destructiveLabel, variant, onConfirm, onCancel },
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
          className="text-[20px] font-bold uppercase text-retro-ink mb-md"
        >
          {title}
        </h2>
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
      </RetroDialog>
    );
  }
);

RetroConfirmDialog.displayName = "RetroConfirmDialog";

export { RetroConfirmDialog };
export type { RetroConfirmDialogProps, RetroConfirmDialogHandle };
