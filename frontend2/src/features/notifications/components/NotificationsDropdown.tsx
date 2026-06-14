import { useRef } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BevelButton, RetroEmptyState } from "@/components/retro";
import { useModalStack } from "@/components/modal";
import { useDateFormat, useTimeFormat } from "@/lib/format";
import { useNotificationsQuery } from "../hooks/useNotifications";
import { useNotificationMutations } from "../hooks/useNotificationMutations";

// Phase 13 Plan 01 — the notifications dropdown (NOTIF-02). A positioned panel
// mirroring the TopBar user-menu markup (absolute, right-aligned,
// bevel-raised-ink, role="menu"). ESC pops THIS overlay via the modal stack —
// onClose is read through the hook's ref, so the handler identity never churns
// the stack (Pitfall 6). Click-outside dismiss mirrors the user-menu pattern:
// the bell owns the outside ref; here a full-screen transparent backdrop closes.
//
// Each unread row shows a per-row "mark read" affordance → markRead(id); a
// header "Mark all read" → markAllRead (disabled when nothing is unread). Read
// rows render muted. Empty list → RetroEmptyState. All strings via <Trans>/t.

export interface NotificationsDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsDropdown({
  open,
  onClose,
}: NotificationsDropdownProps) {
  const { t } = useLingui();
  // I18N-03: route the notification timestamp through the user's regional-format
  // preference (replaced a raw locale-string render).
  const formatDate = useDateFormat();
  const formatTime = useTimeFormat();
  // Stable onClose for the modal stack (read through the hook's internal ref).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useModalStack(open, () => onCloseRef.current());

  const { items, isLoading, isError } = useNotificationsQuery();
  const { markRead, markAllRead } = useNotificationMutations();

  if (!open) return null;

  const hasUnread = items.some((n) => !n.is_read);

  return (
    <>
      {/* Transparent backdrop — click-outside closes (mirrors user-menu dismiss). */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default"
      />
      <div
        role="menu"
        aria-label={t`Notifications`}
        className="absolute right-0 top-[calc(100%+4px)] z-40 max-h-[420px] w-[320px] overflow-y-auto border-2 border-border-ink bg-bg-panel bevel-raised-ink"
      >
        <header className="flex items-center justify-between gap-sp-2 border-b-2 border-border-ink bg-titlebar-blue px-sp-3 py-[6px] pinstripes">
          <h2 className="font-display text-[14px] uppercase tracking-[0.02em] text-fg-ink">
            <Trans>Notifications</Trans>
          </h2>
          <BevelButton
            className="!px-sp-2 !py-[2px] !text-[11px]"
            disabled={!hasUnread || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <Trans>Mark all read</Trans>
          </BevelButton>
        </header>

        {isLoading ? (
          <p className="px-sp-3 py-sp-3 font-mono text-[12px] text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        ) : isError ? (
          <p className="px-sp-3 py-sp-3 text-[13px] font-semibold text-danger">
            <Trans>Couldn't load notifications.</Trans>
          </p>
        ) : items.length === 0 ? (
          <RetroEmptyState
            glyph="◇"
            heading={<Trans>No notifications</Trans>}
            body={<Trans>You're all caught up.</Trans>}
          />
        ) : (
          <ul className="divide-y-2 divide-border-ink">
            {items.map((n) => (
              <li
                key={n.id}
                role="menuitem"
                className={`flex items-start gap-sp-2 px-sp-3 py-sp-2 ${
                  n.is_read ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-fg-ink">
                    {n.title}
                  </p>
                  <p className="text-[12px] text-fg-muted">{n.message}</p>
                  <p className="mt-px font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">
                    {formatDate(n.created_at)} {formatTime(n.created_at)}
                  </p>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    aria-label={t`Mark read`}
                    title={t`Mark read`}
                    disabled={markRead.isPending}
                    onClick={() => markRead.mutate(n.id)}
                    className="flex-none border-2 border-border-ink bg-bg-panel px-sp-1 py-px font-mono text-[11px] leading-none bevel-raised-ink active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed disabled:opacity-50"
                  >
                    <Trans>Mark read</Trans>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
