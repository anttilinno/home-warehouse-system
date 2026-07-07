import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

export interface RetroTab {
  /** Stable tab id (also used to derive ARIA ids and `value`). */
  id: string;
  /** Tab label (11px UPPERCASE folder-tab cap; consumer-supplied text). */
  label: ReactNode;
  /** Panel content shown when this tab is active. */
  content: ReactNode;
  /** When true the tab is not focusable/activatable and is visually muted. */
  disabled?: boolean;
}

export interface RetroTabsProps {
  tabs: RetroTab[];
  /** The active tab id (controlled). */
  value: string;
  /** Fired with the next active tab id on click / arrow navigation. */
  onChange: (id: string) => void;
  /**
   * Hide the tablist below `md` (the active panel still renders). Opt-in for tab
   * sets that are ALSO reachable from the mobile menu (e.g. taxonomy
   * categories/locations/containers each have a Sidebar entry), so the in-page
   * tab strip is redundant on mobile and only forces an awkward horizontal
   * scroll. Other tab sets (settings, detail panels) leave this off.
   */
  hideTablistBelowMd?: boolean;
}

const TAB_BASE =
  "shrink-0 whitespace-nowrap cursor-pointer border-2 border-border-ink border-b-0 px-sp-3 py-[5px] font-body text-11 font-bold uppercase tracking-7 text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";
const TAB_INACTIVE = "bg-bg-panel-2";
const TAB_ACTIVE = "bg-titlebar-blue bevel-raised-ink";
const TAB_DISABLED = "text-fg-muted opacity-50 cursor-not-allowed";

/**
 * Folder-tab control (System-7 idiom) with roving tabindex (TUI data family).
 *
 * The active tab takes the accent fill and connects into the panel below;
 * ←/→ move focus (and activation) across enabled tabs, skipping disabled ones.
 * Full ARIA: `role="tablist"/"tab"/"tabpanel"` with `aria-selected`,
 * `aria-controls`, and `aria-labelledby` wiring.
 */
export function RetroTabs({
  tabs,
  value,
  onChange,
  hideTablistBelowMd = false,
}: Readonly<RetroTabsProps>) {
  const baseId = useId();
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  const enabled = tabs.filter((t) => !t.disabled);
  const active = tabs.find((t) => t.id === value) ?? enabled[0];

  function focusTab(id: string) {
    tabRefs.current.get(id)?.focus();
    onChange(id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, currentId: string) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    if (enabled.length === 0) return;
    const idx = enabled.findIndex((t) => t.id === currentId);
    const start = idx === -1 ? 0 : idx;
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = enabled[(start + delta + enabled.length) % enabled.length];
    focusTab(next.id);
  }

  return (
    <div>
      <div
        role="tablist"
        // Tabs scroll horizontally within their card on narrow screens instead
        // of overflowing past its border (min-w-0 lets the strip shrink; the
        // tabs themselves stay full-size via shrink-0 in TAB_BASE).
        // hideTablistBelowMd: hidden on mobile (menu-reachable tab sets); the
        // active panel still renders below.
        className={`${hideTablistBelowMd ? "hidden md:flex" : "flex"} min-w-0 items-end gap-sp-1 overflow-x-auto border-b-2 border-border-ink`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id;
          let tabState: string;
          if (tab.disabled) {
            tabState = TAB_DISABLED;
          } else if (isActive) {
            tabState = TAB_ACTIVE;
          } else {
            tabState = TAB_INACTIVE;
          }
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              aria-selected={isActive}
              aria-controls={panelId(tab.id)}
              aria-disabled={tab.disabled || undefined}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              className={`${TAB_BASE} ${tabState}`}
              onClick={() => !tab.disabled && onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {active && (
        <div
          role="tabpanel"
          id={panelId(active.id)}
          aria-labelledby={tabId(active.id)}
          // Top border is normally dropped so the active tab connects into the
          // panel. When the tablist is hidden below md, the panel would be an
          // open-topped box — keep its top border on mobile, drop it only at md
          // where the tablist returns.
          //
          // A `content: null` tab (e.g. /scan, whose real surface is a persistent
          // sibling rendered outside the tabs) draws NO panel chrome — an empty
          // bordered box would just float under the strip. The tabpanel element
          // stays (keeps aria-controls valid) but is a zero-height no-op.
          className={
            active.content == null
              ? ""
              : `border-2 ${hideTablistBelowMd ? "md:border-t-0" : "border-t-0"} border-border-ink bg-bg-panel p-sp-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2`
          }
        >
          {active.content}
        </div>
      )}
    </div>
  );
}
