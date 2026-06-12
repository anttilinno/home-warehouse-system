import { useEffect, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import type { User } from "@/lib/types";
import { BrandMark } from "@/components/BrandMark";
import { BevelButton } from "@/components/retro";
import { useModalStack } from "@/components/modal";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

// TopBar (SHELL-03): the slim 40px banner every authenticated route renders.
// Brand + the live WorkspaceSwitcher pill (AUTH-06; reads the D-12 SSOT) +
// ONLINE dot (binds to SSE in Phase 6) + reserved disabled bell/SSE slots
// (Phases 13/6) + a user pill
// whose menu's only enabled item is a confirm-before Log out (BAR-05 — logout is
// NEVER reachable via bare ESC; the confirm pushes onto the modal stack so ESC
// closes the dialog instead of logging out).

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

export interface TopBarProps {
  /** Live connectivity. Defaults true (placeholder until SSE binds in Phase 6). */
  online?: boolean;
  user?: User;
  /** Mobile hamburger toggle for the Navigator drawer (wired in Plan 06). */
  onToggleDrawer?: () => void;
  /** Called only after the user confirms logout in the dialog. */
  onLogout: () => void;
}

export function TopBar({
  online = true,
  user,
  onToggleDrawer,
  onLogout,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click (the confirm dialog owns its own dismiss).
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const initial = (user?.full_name || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <header
      role="banner"
      className="sticky top-0 z-10 flex h-[40px] items-center gap-sp-4 border-b-2 border-border-ink bg-bg-panel px-sp-4 py-sp-1 shadow-[inset_0_-2px_0_var(--bevel-shade)]"
    >
      {/* Mobile hamburger — hidden on desktop where the sidebar is persistent. */}
      <button
        type="button"
        onClick={onToggleDrawer}
        aria-label="Open navigation"
        className={`grid h-[28px] w-[28px] flex-none place-items-center border-2 border-border-ink bg-bg-panel font-mono text-[14px] leading-none bevel-raised-ink active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed md:hidden ${FOCUS_RING}`}
      >
        <span aria-hidden="true">☰</span>
      </button>

      {/* Brand: 30x30 beveled square + WAREHOUSE.SYS mark. */}
      <span className="flex flex-none items-center gap-sp-2">
        <span
          aria-hidden="true"
          className="grid h-[30px] w-[30px] place-items-center border-2 border-border-ink bg-bg-panel font-display text-[16px] bevel-raised-ink"
        >
          ▦
        </span>
        <BrandMark className="text-[16px]" />
      </span>

      {/* Workspace pill — the live AUTH-06 switcher (D-12 SSOT). */}
      <WorkspaceSwitcher />

      {/* ONLINE indicator (binds to live SSE in Phase 6). */}
      <span className="flex flex-none items-center gap-sp-1">
        <span
          aria-hidden="true"
          className={`h-[8px] w-[8px] border border-border-ink ${
            online ? "bg-titlebar-mint" : "bg-fg-faint"
          }`}
        />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-fg-ink">
          {online ? <Trans>ONLINE</Trans> : <Trans>OFFLINE</Trans>}
        </span>
      </span>

      <span className="flex-1" />

      {/* Reserved notifications bell — disabled (Phase 13). */}
      <span
        data-testid="bell-slot"
        aria-disabled="true"
        title="Coming soon"
        className="grid h-[28px] w-[28px] flex-none cursor-default place-items-center border-2 border-border-ink bg-bg-panel font-mono text-[14px] leading-none opacity-50"
      >
        <span aria-hidden="true">▦</span>
      </span>

      {/* Reserved SSE status slot — static placeholder (Phase 6). */}
      <span
        data-testid="sse-slot"
        className="hidden flex-none items-center gap-sp-1 font-mono text-[11px] text-fg-muted md:inline-flex"
      >
        sse:
        <span aria-hidden="true" className="text-fg-ink">
          ● live
        </span>
      </span>

      {/* User pill → menu (this phase: a single confirm-before Log out). */}
      <div ref={menuRef} className="relative flex-none">
        <button
          type="button"
          data-testid="user-pill"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className={`flex items-center gap-sp-2 border-2 border-border-ink bg-bg-panel px-sp-1 py-[2px] bevel-raised-ink active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed ${FOCUS_RING}`}
        >
          <span
            aria-hidden="true"
            className="grid h-[28px] w-[28px] flex-none place-items-center border-2 border-border-ink bg-titlebar-pink font-display text-[16px]"
          >
            {initial}
          </span>
          <span className="hidden max-w-[160px] truncate text-[13px] font-semibold sm:inline">
            {user?.full_name}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[180px] border-2 border-border-ink bg-bg-panel bevel-raised-ink"
          >
            <MenuPlaceholder>
              <Trans>Profile</Trans>
            </MenuPlaceholder>
            <MenuPlaceholder>
              <Trans>Settings</Trans>
            </MenuPlaceholder>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
              className={`block w-full border-t-2 border-border-ink px-sp-3 py-[6px] text-left text-[13px] font-semibold text-danger hover:bg-danger-bg ${FOCUS_RING}`}
            >
              <Trans>Log out</Trans>
            </button>
          </div>
        )}
      </div>

      <LogoutConfirm
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onLogout();
        }}
      />
    </header>
  );
}

function MenuPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-disabled="true"
      title="Coming soon"
      className="block cursor-default px-sp-3 py-[6px] text-[13px] font-semibold text-fg-muted opacity-50"
    >
      {children}
    </span>
  );
}

interface LogoutConfirmProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirm-before-logout dialog. It pushes onto the modal stack so ESC closes
// THIS dialog (never logs out — BAR-05). Confirm = LOG OUT; cancel = STAY.
function LogoutConfirm({ open, onCancel, onConfirm }: LogoutConfirmProps) {
  useModalStack(open, onCancel);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-fg-ink/40"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-[min(420px,92vw)] border-2 border-border-ink bg-bg-panel bevel-raised"
      >
        <header className="border-b-2 border-border-ink bg-titlebar-pink px-sp-3 py-[6px] pinstripes">
          <h2
            id="logout-confirm-title"
            className="text-center font-display text-[16px] uppercase tracking-[0.02em]"
          >
            <Trans>Log out</Trans>
          </h2>
        </header>
        <div className="p-sp-4">
          <p className="text-[14px] text-fg-ink">
            <Trans>End this session? You will need to sign in again.</Trans>
          </p>
          <div className="mt-sp-4 flex justify-end gap-sp-2">
            <BevelButton onClick={onCancel}>
              <Trans>Stay</Trans>
            </BevelButton>
            <BevelButton variant="danger" onClick={onConfirm}>
              <Trans>Log out</Trans>
            </BevelButton>
          </div>
        </div>
      </div>
    </div>
  );
}
