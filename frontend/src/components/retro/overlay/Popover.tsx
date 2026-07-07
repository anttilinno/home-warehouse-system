import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useModalStack } from "@/components/modal";

export interface PopoverProps {
  /** Whether the popover is open. */
  open: boolean;
  /** Called when the popover requests close (ESC via modal stack or tap-outside). */
  onClose: () => void;
  /** The trigger element the panel anchors to and restores focus to on close. */
  anchorRef: RefObject<HTMLElement | null>;
  /** ARIA role of the floating panel. "menu" (actions) or "listbox" (selection). */
  role: "menu" | "listbox";
  /** Optional min-width override. Default 160px. */
  minWidth?: number;
  /**
   * Chrome: "anchor" floats under the trigger (default). "sheet" pins a
   * full-width panel to the bottom edge behind a scrim — the mobile treatment.
   */
  variant?: "anchor" | "sheet";
  children: ReactNode;
}

/**
 * The shared chromeless-utility floating panel (combobox listbox, FilterPopover,
 * SavedFilters menu, row-action menu all build on it). Raised bevel surface with
 * NO pinstriped titlebar ("plain = chromeless utility"). Anchored under its
 * trigger (flips above when there is no room below). ESC routes EXCLUSIVELY
 * through {@link useModalStack} (no document-level ESC listener); tap-outside
 * closes; focus moves into the panel on open and restores to the anchor on close.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  role,
  minWidth = 160,
  variant = "anchor",
  children,
}: Readonly<PopoverProps>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const isSheet = variant === "sheet";

  // ESC pops via the shared modal stack (never logout).
  useModalStack(open, onClose);

  // Position the panel under (or above, if no room) the anchor. A sheet is
  // CSS-pinned to the bottom edge, so it skips anchor math entirely.
  useLayoutEffect(() => {
    if (!open || isSheet) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const ph = panel.offsetHeight;
    const spaceBelow = window.innerHeight - a.bottom;
    const flipUp = spaceBelow < ph && a.top > ph;
    const top = flipUp ? a.top - ph : a.bottom;
    setPos({ top, left: a.left });
  }, [open, anchorRef, isSheet]);

  // Focus management: move focus into the panel on open, restore to anchor on close.
  useEffect(() => {
    if (!open) return;
    invokerRef.current =
      anchorRef.current ?? (document.activeElement as HTMLElement | null);
    const node = panelRef.current;
    const focusables = node?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusables && focusables.length > 0 ? focusables[0] : node)?.focus();
    return () => {
      invokerRef.current?.focus?.();
    };
  }, [open, anchorRef]);

  if (!open) return null;

  return (
    <>
      {/* Tap-outside sentinel: closes on click. A sheet dims behind a scrim. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: tap-outside backdrop; Escape closes via the modal stack */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: tap-outside backdrop; Escape closes via the modal stack */}
      <div
        data-testid="popover-backdrop"
        className={`fixed inset-0 z-40 ${isSheet ? "bg-black/50" : ""}`}
        onClick={onClose}
      />
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops backdrop-click propagation only, not an interactive control */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dynamic role ("menu"/"listbox") is interactive; click only stops backdrop-close propagation */}
      <div
        ref={panelRef}
        role={role}
        tabIndex={-1}
        className={
          isSheet
            ? "fixed inset-x-0 bottom-0 z-40 flex max-h-[75vh] flex-col overflow-y-auto border-t-2 border-border-ink bg-bg-panel bevel-raised py-sp-1 outline-none"
            : "fixed z-40 flex flex-col border-2 border-border-ink bg-bg-panel bevel-raised py-sp-1 outline-none"
        }
        style={isSheet ? undefined : { top: pos.top, left: pos.left, minWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
