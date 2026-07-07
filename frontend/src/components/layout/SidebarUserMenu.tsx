import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Trans } from "@lingui/react/macro";
import type { User } from "@/lib/types";
import { LogoutConfirm } from "./LogoutConfirm";

// SidebarUserMenu — the account affordance pinned to the bottom of the docked
// Navigator. A button (avatar + name/email) opens an UPWARD popover (Profile /
// Settings / Log out). Log out is confirm-gated via the shared LogoutConfirm
// (BAR-05: never one-click). In collapsed rail mode the `.nav-label` text hides
// (globals.css [data-collapsed] rule) leaving just the avatar — the popover
// still opens.

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

export interface SidebarUserMenuProps {
  user: User;
  onLogout: () => void;
}

export function SidebarUserMenu({
  user,
  onLogout,
}: Readonly<SidebarUserMenuProps>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click (the confirm dialog owns its own dismiss).
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const initial = (user.full_name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative mt-auto pt-sp-2">
      <button
        type="button"
        data-testid="sidebar-user-menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={user.full_name || user.email || "Account menu"}
        onClick={() => setMenuOpen((v) => !v)}
        className={`flex w-full items-center gap-sp-2 border-2 border-border-ink bg-bg-panel p-sp-2 text-left bevel-raised-ink hover:brightness-103 active:bevel-pressed ${FOCUS_RING}`}
      >
        <span
          aria-hidden="true"
          className="grid h-[28px] w-[28px] flex-none place-items-center border-2 border-border-ink bg-titlebar-pink font-display text-16"
        >
          {initial}
        </span>
        <span className="nav-label min-w-0 flex-1">
          <span className="block truncate text-13 font-semibold uppercase tracking-4">
            {user.full_name}
          </span>
          <span className="block truncate text-11 text-fg-muted">
            {user.email}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="nav-label flex-none font-mono text-12 text-fg-muted"
        >
          {menuOpen ? "▾" : "▴"}
        </span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+4px)] left-0 z-20 w-full min-w-[180px] border-2 border-border-ink bg-bg-panel bevel-raised-ink"
        >
          <Link
            to="/settings/profile"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className={`block px-sp-3 py-[6px] max-md:py-sp-3 text-13 font-semibold uppercase tracking-4 text-fg-ink hover:bg-bg-panel-2 ${FOCUS_RING}`}
          >
            <Trans>Profile</Trans>
          </Link>
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className={`block px-sp-3 py-[6px] max-md:py-sp-3 text-13 font-semibold uppercase tracking-4 text-fg-ink hover:bg-bg-panel-2 ${FOCUS_RING}`}
          >
            <Trans>Settings</Trans>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
            className={`block w-full px-sp-3 py-[6px] max-md:py-sp-3 text-left text-13 font-semibold uppercase tracking-4 text-danger hover:bg-danger-bg ${FOCUS_RING}`}
          >
            <Trans>Log out</Trans>
          </button>
        </div>
      )}

      <LogoutConfirm
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onLogout();
        }}
      />
    </div>
  );
}
