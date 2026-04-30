"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface Shortcut {
  /** Single character (`"N"`) or function key (`"F1"`). Matched case-insensitive. */
  key: string;
  label: string;
  action: () => void;
  /** Render with destructive styling. */
  danger?: boolean;
}

interface ShortcutsContextValue {
  shortcuts: Shortcut[];
  register: (id: string, shortcuts: Shortcut[]) => void;
  unregister: (id: string) => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo(
    () => ({ shortcuts, register, unregister }),
    [shortcuts, register, unregister]
  );

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcutsContext() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) {
    throw new Error("useShortcutsContext must be used inside <ShortcutsProvider>");
  }
  return ctx;
}
