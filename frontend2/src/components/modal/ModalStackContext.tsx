import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

/**
 * A single entry in the modal stack: a unique token plus the overlay's closer.
 */
interface ModalStackEntry {
  token: symbol;
  close: () => void;
}

/**
 * The arbiter context for ESC ordering across every overlay in the app (the F1
 * help dialog, the mobile drawer, the FAB menu, and any future overlay).
 *
 * `push(close)` registers an overlay's closer and returns a token; `pop(token)`
 * removes that specific entry. A single document-level keydown listener — owned
 * here, nowhere else — pops the TOPMOST entry on ESC. When the stack is empty,
 * ESC is a no-op and never reaches any other handler (in particular it can never
 * reach logout — BAR-05 / TUI-02).
 */
export interface ModalStackValue {
  /** Push an overlay closer; returns a token to pop it with later. */
  push: (close: () => void) => symbol;
  /** Remove the entry identified by `token` (idempotent if already gone). */
  pop: (token: symbol) => void;
}

const ModalStackContext = createContext<ModalStackValue | null>(null);

export function ModalStackProvider({ children }: { children: ReactNode }) {
  // The stack lives in a ref, not state: pushing/popping an overlay must not
  // re-render the whole subtree, and the keydown listener (installed once) reads
  // the current stack synchronously via the ref.
  const stackRef = useRef<ModalStackEntry[]>([]);

  const push = useCallback((close: () => void) => {
    const token = Symbol("modal-stack-entry");
    stackRef.current.push({ token, close });
    return token;
  }, []);

  const pop = useCallback((token: symbol) => {
    const stack = stackRef.current;
    const index = stack.findIndex((entry) => entry.token === token);
    if (index !== -1) {
      stack.splice(index, 1);
    }
  }, []);

  // Single owner of the ESC listener (mirrors the single-listener + cleanup
  // discipline from the shortcuts provider). Installed once for the provider's
  // lifetime; reads the live stack through the ref.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const stack = stackRef.current;
      if (stack.length === 0) return; // empty stack → ESC is a no-op (never logs out)
      event.preventDefault();
      stack[stack.length - 1].close(); // pop the TOP overlay only
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo<ModalStackValue>(() => ({ push, pop }), [push, pop]);

  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
}

/**
 * Access the modal stack. Throws if used outside a {@link ModalStackProvider}
 * so a missing provider fails loud at the call site rather than silently
 * dropping ESC ordering.
 */
export function useModalStackContext(): ModalStackValue {
  const value = useContext(ModalStackContext);
  if (value === null) {
    throw new Error(
      "useModalStackContext must be used within a <ModalStackProvider>",
    );
  }
  return value;
}
