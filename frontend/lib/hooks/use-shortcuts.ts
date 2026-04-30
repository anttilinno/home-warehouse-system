"use client";

import { useEffect, useId } from "react";
import {
  useShortcutsContext,
  type Shortcut,
} from "@/components/layout/shortcuts-context";

/**
 * Register a route-level shortcut set. The Bottombar renders chips and
 * binds keydown for these, plus the global F1 (help) and ESC (logout) chips.
 *
 * Shortcuts are flattened across all callers, so a single page can split
 * registration across components if needed.
 */
export function useShortcuts(shortcuts: Shortcut[]) {
  const { register, unregister } = useShortcutsContext();
  const id = useId();

  useEffect(() => {
    register(id, shortcuts);
    return () => unregister(id);
  }, [id, register, unregister, shortcuts]);
}
