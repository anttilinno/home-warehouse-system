import { Trans } from "@lingui/react/macro";
import { BrandMark } from "@/components/BrandMark";
import { PixelIcon, RetroStatusDot, StatusPill } from "@/components/retro";
import { useTheme } from "@/lib/useTheme";
import { useSSEStatus } from "@/features/sse";
import { useIsOnline } from "@/lib/offline/useIsOnline";
import { usePendingWrites } from "@/lib/offline/usePendingWrites";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

// TopBar (SHELL-03): the slim 40px banner every authenticated route renders.
// Brand + the live WorkspaceSwitcher pill (AUTH-06; reads the D-12 SSOT) +
// ONLINE dot + sse-slot RetroStatusDot + live notifications bell (Phase 13).
// The account menu (Profile / Settings / confirm-before Log out) lives in the
// Sidebar/MobileDrawer user menu now — the redundant TopBar account pill was
// removed.
//
// SSE binding (PROV-01, design choice): TopBar reads `useSSEStatus()` directly
// and feeds the DUMB RetroStatusDot atom its `state` (Pitfall 6 — the atom never
// imports SSE; we feed it) for the sse-slot ONLY.
//
// ONLINE dot rebinding (offline-first PWA Phase 4): the ONLINE/OFFLINE chip now
// reads real browser network state via `useIsOnline()` (TanStack's
// `onlineManager`), NOT SSE `connected` — a dropped SSE stream on a healthy
// network used to falsely read OFFLINE. The `online?: boolean` prop is KEPT for
// test injectability and DEFAULTS to `useIsOnline()` when omitted. A "N pending"
// badge (paused/queued offline writes, `usePendingWrites()`) renders next to it.

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

// ⌘K on Apple, Ctrl+K elsewhere — match the tinykeys `$mod+k` chord label.
// navigator.platform is deprecated; prefer userAgentData, then a UA regex,
// with the legacy field as final fallback.
const IS_APPLE =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ||
      navigator.userAgent ||
      navigator.platform,
  );
const SEARCH_HINT = IS_APPLE ? "⌘K" : "Ctrl K";

export interface TopBarProps {
  /**
   * Live connectivity for the ONLINE dot. Optional: defaults to
   * `useIsOnline()` (real network state) when omitted — tests pass this to
   * force a state without touching `navigator.onLine`.
   */
  online?: boolean;
  /** Mobile hamburger toggle for the Navigator drawer (wired in Plan 06). */
  onToggleDrawer?: () => void;
  /** Open the global search / command palette (⌘K / F2 also open it). */
  onOpenSearch?: () => void;
}

export function TopBar({
  online,
  onToggleDrawer,
  onOpenSearch,
}: Readonly<TopBarProps>) {
  // Live SSE connection status — drives ONLY the sse-slot RetroStatusDot now.
  const { connected } = useSSEStatus();
  // Real network state (Phase 4) — drives the ONLINE dot when no explicit
  // `online` prop is passed.
  const networkOnline = useIsOnline();
  const isOnline = online ?? networkOnline;
  const pendingWrites = usePendingWrites();

  // Quick theme toggle: flip to the OPPOSITE of what's currently painted (a
  // `system` pref resolves to one of the two, so the click always lands on a
  // concrete light|dark). Settings → Appearance keeps the full 3-way selector.
  const { resolved, setPref } = useTheme();
  const goingDark = resolved === "light";

  return (
    <header className="sticky top-0 z-10 flex h-[40px] items-center gap-sp-2 border-b-2 border-border-ink bg-bg-panel px-sp-3 py-sp-1 shadow-[inset_0_-2px_0_var(--bevel-shade)] md:gap-sp-4 md:px-sp-4">
      {/* Mobile hamburger — hidden on desktop where the sidebar is persistent.
          Visual stays 28px (fits the 40px bar); the ::before extends the tap
          target to 44px so it clears the touch-target minimum (C1). */}
      <button
        type="button"
        onClick={onToggleDrawer}
        aria-label="Open navigation"
        title="Open navigation"
        className={`relative grid h-[28px] w-[28px] flex-none place-items-center border-2 border-border-ink bg-bg-panel font-mono text-14 leading-none bevel-raised-ink before:absolute before:-inset-2 before:content-[''] active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed md:hidden ${FOCUS_RING}`}
      >
        <PixelIcon name="menu" />
      </button>

      {/* Brand: 30x30 beveled square + WAREHOUSE.SYS mark. */}
      <span className="flex flex-none items-center gap-sp-2">
        <span
          aria-hidden="true"
          className="grid h-[30px] w-[30px] place-items-center border-2 border-border-ink bg-bg-panel font-display text-16 bevel-raised-ink"
        >
          <PixelIcon name="app-windows" size={16} />
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
            isOnline ? "bg-status-online" : "bg-fg-faint"
          }`}
        />
        <span className="hidden text-11 font-bold uppercase tracking-10 text-fg-ink sm:inline">
          {isOnline ? <Trans>ONLINE</Trans> : <Trans>OFFLINE</Trans>}
        </span>
      </span>

      {/* Pending-writes badge (Phase 4) — paused offline mutations queued for
          the next reconnect drain. Hidden entirely at 0 (no empty chip). */}
      {pendingWrites > 0 && (
        <span data-testid="pending-writes-badge" className="flex-none">
          <StatusPill variant="warn">
            <Trans>{pendingWrites} pending</Trans>
          </StatusPill>
        </span>
      )}

      {/* Global search trigger — opens the command palette (⌘K / Ctrl+K / F2).
          The visible counterpart to the keyboard-only chord; styled as a faux
          search field that grows to fill the bar's centre. */}
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search"
        aria-keyshortcuts="Meta+K Control+K"
        className={`mx-sp-2 flex h-[28px] min-w-0 max-w-[420px] flex-1 items-center gap-sp-2 border-2 border-border-ink bg-bg-panel-2 px-sp-2 text-12 text-fg-muted bevel-pressed hover:text-fg-ink active:translate-x-px active:translate-y-px ${FOCUS_RING}`}
      >
        <PixelIcon name="search" />
        <span className="truncate">
          <Trans>Search…</Trans>
        </span>
        <kbd className="ml-auto hidden flex-none border border-border-ink bg-bg-panel px-sp-1 font-mono text-10 text-fg-ink sm:inline">
          {SEARCH_HINT}
        </kbd>
      </button>

      {/* Theme quick-toggle — moon to go dark, sun to go light. Mirrors the
          hamburger's beveled-square chrome. Full 3-way pref in Settings. */}
      <button
        type="button"
        onClick={() => setPref(goingDark ? "dark" : "light")}
        aria-label={
          goingDark ? "Switch to dark theme" : "Switch to light theme"
        }
        title={goingDark ? "Switch to dark theme" : "Switch to light theme"}
        className={`ml-auto grid h-[28px] w-[28px] flex-none place-items-center border-2 border-border-ink bg-bg-panel font-mono text-14 leading-none bevel-raised-ink active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed ${FOCUS_RING}`}
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
