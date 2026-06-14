import { useEffect, useRef } from "react";
import { useModalStackContext } from "./ModalStackContext";

/**
 * Ergonomic one-call wrapper every overlay (F1 dialog, drawer, FAB menu) uses:
 * while `isOpen` is true, an entry is pushed onto the modal stack so ESC closes
 * THIS overlay (topmost-first); when `isOpen` flips false OR the component
 * unmounts, the entry pops. The stack always returns to balanced.
 *
 * `onClose` is read through a ref so a fresh closure each render does not churn
 * the stack — the pushed entry stays stable for the open lifetime and always
 * invokes the latest callback.
 *
 * @param isOpen  whether the overlay is currently open
 * @param onClose called when ESC pops this overlay (the close handler)
 */
export function useModalStack(isOpen: boolean, onClose: () => void): void {
  const { push, pop } = useModalStackContext();

  // Keep the latest onClose without re-pushing: the stack entry calls through
  // this ref, so changing the handler identity never re-registers the overlay.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const token = push(() => onCloseRef.current());
    return () => pop(token);
  }, [isOpen, push, pop]);
}
