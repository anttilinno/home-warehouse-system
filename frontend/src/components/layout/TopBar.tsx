import { Trans } from "@lingui/react/macro";
import { BrandMark } from "@/components/BrandMark";
import { RetroStatusDot } from "@/components/retro";
import { useTheme } from "@/lib/useTheme";
import { useSSEStatus } from "@/features/sse";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

// TopBar (SHELL-03): the slim 40px banner every authenticated route renders.
// Brand + the live WorkspaceSwitcher pill (AUTH-06; reads the D-12 SSOT) +
// ONLINE dot + sse-slot RetroStatusDot (both bound to live SSE — Phase 6) +
// live notifications bell (Phase 13). The account menu (Profile / Settings /
// confirm-before Log out) lives in the Sidebar/MobileDrawer user menu now — the
// redundant TopBar account pill was removed.
//
// SSE binding (PROV-01, design choice): TopBar reads `useSSEStatus()` directly
// and feeds the DUMB RetroStatusDot atom its `state` (Pitfall 6 — the atom never
// imports SSE; we feed it). The `online?: boolean` prop is KEPT for test
// injectability and is threaded by AppShell, but DEFAULTS to the live
// `connected` when omitted, so a TopBar mounted under SSEProvider needs no prop.

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

export interface TopBarProps {
  /**
   * Live connectivity for the ONLINE dot. Optional: defaults to
   * `useSSEStatus().connected` when omitted (AppShell passes it explicitly).
   */
  online?: boolean;
  /** Mobile hamburger toggle for the Navigator drawer (wired in Plan 06). */
  onToggleDrawer?: () => void;
}

export function TopBar({ online, onToggleDrawer }: Readonly<TopBarProps>) {
  // Live SSE connection status — drives BOTH the ONLINE dot (when no explicit
  // `online` prop) AND the sse-slot RetroStatusDot.
  const { connected } = useSSEStatus();
  const isOnline = online ?? connected;

  // Quick theme toggle: flip to the OPPOSITE of what's currently painted (a
  // `system` pref resolves to one of the two, so the click always lands on a
  // concrete light|dark). Settings → Appearance keeps the full 3-way selector.
  const { resolved, setPref } = useTheme();
  const goingDark = resolved === "light";

  return (
    <header className="sticky top-0 z-10 flex h-[40px] items-center gap-sp-2 border-b-2 border-border-ink bg-bg-panel px-sp-3 py-sp-1 shadow-[inset_0_-2px_0_var(--bevel-shade)] md:gap-sp-4 md:px-sp-4">
      {/* Mobile hamburger — hidden on desktop where the sidebar is persistent. */}
      <button
        type="button"
        onClick={onToggleDrawer}
        aria-label="Open navigation"
        title="Open navigation"
        className={`grid h-[28px] w-[28px] flex-none place-items-center border-2 border-border-ink bg-bg-panel font-mono text-14 leading-none bevel-raised-ink active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed md:hidden ${FOCUS_RING}`}
      >
        <span aria-hidden="true">☰</span>
      </button>

      {/* Brand: 30x30 beveled square + WAREHOUSE.SYS mark. */}
      <span className="flex flex-none items-center gap-sp-2">
        <span
          aria-hidden="true"
          className="grid h-[30px] w-[30px] place-items-center border-2 border-border-ink bg-bg-panel font-display text-16 bevel-raised-ink"
        >
          ▦
        </span>
        <BrandMark className="hidden text-16 sm:inline-block" />
      </span>

      {/* Workspace pill — the live AUTH-06 switcher (D-12 SSOT). */}
      <WorkspaceSwitcher />

      {/* ONLINE indicator — bound to live SSE connection status (Phase 6). */}
      <span className="flex flex-none items-center gap-sp-1">
        <span
          aria-hidden="true"
          className={`h-[8px] w-[8px] border border-border-ink ${
            isOnline ? "bg-titlebar-mint" : "bg-fg-faint"
          }`}
        />
        <span className="hidden text-11 font-bold uppercase tracking-10 text-fg-ink sm:inline">
          {isOnline ? <Trans>ONLINE</Trans> : <Trans>OFFLINE</Trans>}
        </span>
      </span>

      <span className="flex-1" />

      {/* Theme quick-toggle — moon to go dark, sun to go light. Mirrors the
          hamburger's beveled-square chrome. Full 3-way pref in Settings. */}
      <button
        type="button"
        onClick={() => setPref(goingDark ? "dark" : "light")}
        aria-label={
          goingDark ? "Switch to dark theme" : "Switch to light theme"
        }
        title={goingDark ? "Switch to dark theme" : "Switch to light theme"}
        className={`grid h-[28px] w-[28px] flex-none place-items-center border-2 border-border-ink bg-bg-panel font-mono text-14 leading-none bevel-raised-ink active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed ${FOCUS_RING}`}
      >
        <span aria-hidden="true">{goingDark ? "☾" : "☀"}</span>
      </button>

      {/* Live notifications bell — bell button + unread badge + dropdown (Phase 13). */}
      <NotificationsBell />

      {/* SSE status slot — the live RetroStatusDot fed by useSSEStatus (Phase 6).
          Atom stays dumb: TopBar maps connected→"live"/"idle" (Pitfall 6). */}
      <span
        data-testid="sse-slot"
        className="hidden flex-none items-center md:inline-flex"
      >
        <RetroStatusDot state={connected ? "live" : "idle"} />
      </span>
    </header>
  );
}
