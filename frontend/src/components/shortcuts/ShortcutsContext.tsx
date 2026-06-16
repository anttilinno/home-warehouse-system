import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isEditableTarget } from "./isEditableTarget";

export interface Shortcut {
  /** Single character (`"N"`) or function key (`"F1"`). Matched case-insensitive. */
  key: string;
  label: string;
  action: () => void;
  /** Render with destructive styling. */
  danger?: boolean;
}

interface ShortcutsContextValue {
  /** The merged, flicker-free union of every registered group. */
  shortcuts: Shortcut[];
  register: (id: string, shortcuts: Shortcut[]) => void;
  unregister: (id: string) => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

/**
 * Single source of truth for keyboard shortcuts (D-08): a keyed registry that
 * the Bottombar and the FAB both read, plus the ONE document-level keydown
 * dispatcher for the whole app.
 *
 * The provider owns exactly one listener (Pitfall 2 — no second owner in the
 * Bottombar). A `shortcutsRef` is kept synced via effect so the handler reads
 * live bindings without re-subscribing every render (Pitfall 3), and the effect
 * always returns its `removeEventListener` cleanup — making React 19 StrictMode
 * double-invoke a no-op rather than a double-fire.
 */
export function ShortcutsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [groups, setGroups] = useState<Record<string, Shortcut[]>>({});

  const register = useCallback((id: string, shortcuts: Shortcut[]) => {
    setGroups((prev) => ({ ...prev, [id]: shortcuts }));
  }, []);

  const unregister = useCallback((id: string) => {
    setGroups((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const shortcuts = useMemo(() => Object.values(groups).flat(), [groups]);

  // Keep a live ref so the single keydown handler reads current bindings
  // without being re-created (and re-subscribed) on every render.
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Modifier combos belong to the browser / OS, not single-letter shortcuts.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // BAR-03: never fire while typing in an editable surface.
      if (isEditableTarget(e.target)) return;
      const match = shortcutsRef.current.find(
        (s) => s.key.toUpperCase() === e.key.toUpperCase(),
      );
      if (!match) return;
      e.preventDefault();
      match.action();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const value = useMemo(
    () => ({ shortcuts, register, unregister }),
    [shortcuts, register, unregister],
  );

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcutsContext(): ShortcutsContextValue {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) {
    throw new Error(
      "useShortcutsContext must be used inside <ShortcutsProvider>",
    );
  }
  return ctx;
}
