import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroBadge } from "@/components/retro";
import { useUnreadCountQuery } from "../hooks/useNotifications";
import { NotificationsDropdown } from "./NotificationsDropdown";

// Phase 13 Plan 01 — the TopBar notifications bell (NOTIF-01/03). A 28×28
// beveled toggle carrying the STABLE data-testid="bell-slot" (so existing
// TopBar chrome tests that query the reserved slot still resolve). Reads
// useUnreadCountQuery; when count > 0 it renders a RetroBadge (danger variant)
// over the bell — when 0 NO badge node renders. Click toggles the dropdown;
// outside-click + ESC (modal stack, owned by the dropdown) both close it. All
// strings via useLingui `t`.

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

export function NotificationsBell() {
  const { t } = useLingui();
  const { count } = useUnreadCountQuery();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Outside-click close (mirrors the TopBar user-menu menuRef pattern). The
  // dropdown's modal-stack entry handles ESC; this handles pointer dismiss.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const hasUnread = count > 0;
  const badgeLabel = count > 99 ? "99+" : String(count);

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        data-testid="bell-slot"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t`Notifications`}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-[28px] w-[28px] place-items-center border-2 border-border-ink bg-bg-panel font-mono text-[14px] leading-none bevel-raised-ink active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed ${FOCUS_RING}`}
      >
        <span aria-hidden="true">▦</span>
        {hasUnread && (
          <RetroBadge
            variant="danger"
            className="!absolute -right-[6px] -top-[6px] !px-sp-1 !py-0 !text-[9px] !leading-none"
          >
            {badgeLabel}
          </RetroBadge>
        )}
      </button>

      <NotificationsDropdown open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
