import { useEffect, useId } from "react";
import { useShortcutsContext, type Shortcut } from "./ShortcutsContext";

/**
 * Register a route's keyboard shortcuts into the SSOT (BAR-02 / TUI-01 / D-08).
 *
 * Pass a STABLE `id` (typically the route name) so re-registering the same
 * route replaces its group in place — the merged chip row reconciles instead
 * of unmount/remount-flickering on route change (TUI-01). When `id` is omitted
 * the hook self-assigns a stable `useId()` value (orchestrator resolution #3).
 *
 * NOTE (Pitfall 3): callers passing an inline array literal should `useMemo`
 * their `bindings` — a fresh array identity each render re-runs the register
 * effect and churns the registry. A stable `bindings` reference keeps
 * registration flicker-free.
 */
export function useShortcuts(
  id: string | undefined,
  bindings: Shortcut[],
): void {
  const fallbackId = useId();
  const groupId = id ?? fallbackId;
  const { register, unregister } = useShortcutsContext();

  useEffect(() => {
    register(groupId, bindings);
    return () => unregister(groupId);
  }, [groupId, bindings, register, unregister]);
}
