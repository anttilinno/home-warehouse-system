import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useShortcutsContext, type Shortcut } from "@/components/shortcuts";
import { useModalStack } from "@/components/modal";

/**
 * The mobile-only Floating Action Button (D-05, D-07, D-08).
 *
 * The FAB is the <768px counterpart of the desktop Bottombar — it is the SAME
 * SSOT, two surfaces: its action set derives from {@link useShortcutsContext},
 * NOT a second source (orchestrator resolution #1; the legacy `useFABActions`
 * is a shape reference only). Tapping opens an upward staggered stack of bevel
 * keycap buttons (`role="menu"` / `role="menuitem"`); tapping again or scrim/ESC
 * closes it (via the shared modal stack). Selecting an item runs its action then
 * closes. Transitions are CSS-only (no `motion` library — locked decision) and
 * collapse to instant under `prefers-reduced-motion`.
 *
 * Mobile-only via `md:hidden` (D-05); the Bottombar is the ≥768px counterpart.
 */
export function Fab() {
  const { shortcuts } = useShortcutsContext();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);
  // ESC/scrim close via the shared modal stack (never logout).
  useModalStack(open, close);

  // The action set IS the route's registered shortcuts (the SSOT). When a route
  // registers none, fall back to a single default "+ ADD ITEM" so the FAB always
  // exposes one action (UI-SPEC §FAB).
  const actions = useMemo<Shortcut[]>(() => {
    if (shortcuts.length > 0) return shortcuts;
    return [
      {
        key: "+",
        label: "Add item",
        action: () => navigate("/items/new"),
      },
    ];
  }, [shortcuts, navigate]);

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+var(--sp-4))] right-sp-4 z-30 md:hidden">
      {open && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 -z-10 bg-fg-ink/40"
          onClick={close}
        />
      )}

      <div className="relative flex flex-col-reverse items-end gap-sp-2">
        <button
          type="button"
          aria-label="Quick actions"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-14 w-14 items-center justify-center border-2 border-border-ink bg-titlebar-blue font-display text-16 bevel-raised-ink active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-ink"
        >
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-[120ms] ease-out motion-reduce:transition-none"
            style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          >
            +
          </span>
        </button>

        {open && (
          <ul
            role="menu"
            aria-label="Quick actions"
            className="absolute bottom-full right-0 mb-sp-2 flex flex-col-reverse items-end gap-sp-2"
          >
            {actions.map((s, i) => (
              <li key={`${s.key}-${i}`} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    s.action();
                    close();
                  }}
                  style={{ transitionDelay: `${i * 40}ms` }}
                  className={`inline-flex items-center gap-sp-1 border-2 border-border-ink px-sp-2 py-[6px] bevel-raised-ink transition-[transform,opacity] duration-[120ms] ease-out motion-reduce:transition-none active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-ink ${
                    s.danger
                      ? "bg-danger-bg text-danger"
                      : "bg-bg-panel text-fg-ink"
                  }`}
                >
                  <span className="inline-flex items-center justify-center border border-border-ink bg-bg-panel-2 px-1 font-mono text-12 font-semibold">
                    {s.key}
                  </span>
                  <span className="font-body text-11 font-bold uppercase tracking-10">
                    {s.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
