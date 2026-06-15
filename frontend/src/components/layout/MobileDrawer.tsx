import { useEffect, useRef } from "react";
import type { DashboardStats, User } from "@/lib/types";
import { useModalStack } from "@/components/modal";
import { Sidebar } from "./Sidebar";

// MobileDrawer (SHELL-06, <768px): the Navigator (Plan 04 Sidebar) rendered as
// a fixed off-canvas overlay (min(280px, 86vw)) over a bg-fg-ink/40 scrim. It
// is `role="dialog" aria-modal="true"`, focus-trapped, and dismissed by scrim
// click, ESC (via the shared modal stack — never logout), or a nav selection.
// Focus returns to the invoking hamburger on close. CSS-only transitions
// collapse to instant under prefers-reduced-motion.

export interface MobileDrawerProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** Close handler — scrim click, ESC, and nav selection all call it. */
  onClose: () => void;
  stats?: DashboardStats;
  user?: User;
  /** Logout handler for the Sidebar's bottom user menu (confirm-gated). */
  onLogout?: () => void;
}

export function MobileDrawer({
  open,
  onClose,
  stats,
  user,
  onLogout,
}: MobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);

  // ESC pops THIS overlay via the shared modal stack (never logout — BAR-05).
  useModalStack(open, onClose);

  // Focus management: remember the invoker, move focus into the panel on open,
  // trap Tab inside, and restore focus to the invoker on close.
  useEffect(() => {
    if (!open) return;
    invokerRef.current = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    node?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node?.addEventListener("keydown", onKeyDown);
    return () => {
      node?.removeEventListener("keydown", onKeyDown);
      invokerRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        data-testid="drawer-scrim"
        onClick={onClose}
        className="absolute inset-0 bg-fg-ink/40"
      />
      {/* A nav selection (real NavLink click) also closes the drawer; capture
          it at the panel so any nav-item activation dismisses the overlay. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: delegated to child links — keyboard Enter on a NavLink already dispatches a click, which this captures; no separate key handler needed. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigator"
        tabIndex={-1}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a[href]")) onClose();
        }}
        className="absolute inset-y-0 left-0 w-[min(280px,86vw)] overflow-y-auto bg-bg-panel outline-none transition-transform duration-[160ms] ease-out motion-reduce:transition-none"
      >
        <Sidebar stats={stats} user={user} onLogout={onLogout} />
      </div>
    </div>
  );
}
