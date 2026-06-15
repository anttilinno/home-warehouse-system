import { Toaster as SonnerToaster } from "sonner";

/**
 * RetroToaster — the retro-os skin over sonner's `<Toaster>`.
 *
 * Engine arbitration (FINAL): sonner@2.0.7 is the toast engine (registry-
 * verified + exact-pinned in Plan 04-01). The UI-SPEC "sonner declined" note is
 * superseded on the ENGINE only; the UI-SPEC toast VISUAL contract is binding
 * and realised here. Phase 4 ships this component; Phase 6 mounts it in the
 * provider stack.
 *
 * Skin strategy (Pitfall 4): `toastOptions.unstyled` strips sonner's default
 * chrome (its corner radius, soft shadow, and system font), and `classNames`
 * rebuilds each toast as a mini-Window — `border-2 border-border-ink
 * bevel-raised`, radius 0 (zero corner-radius utilities anywhere), IBM Plex
 * body, Silkscreen ≥16px titlebar label. Per-type semantic titlebar stripes
 * come from the `icons` slot (which
 * sonner renders as the leading row): success=mint/DONE/✓, info=blue/INFO/●,
 * warning=butter/WARN/⚠, danger=pink/ERROR/✕.
 *
 * Behavior: non-danger types auto-dismiss (~5s) with native hover-pause; danger
 * (`error`) toasts never auto-dismiss — enforced in `retroToast.error`
 * (retroToast.ts) via `duration: Infinity`. Every toast carries a close box
 * (`aria-label="Dismiss"`). sonner honours `prefers-reduced-motion` natively
 * (its stylesheet disables transitions/animations) and we add no motion lib —
 * all transitions are CSS, satisfying the v3.0 no-motion-lib constraint.
 */

// Each type's titlebar label = a Silkscreen ≥16px uppercase chip + lead glyph,
// tinted with the MANIFEST pastel for that semantic. Rendered into sonner's
// `[data-icon]` slot, which the `classNames.icon` rule stretches into a full
// pinstriped titlebar bar (see globals.css `.retro-toast` rules).
function TitlebarLabel({
  tint,
  glyph,
  label,
}: {
  tint: string;
  glyph: string;
  label: string;
}) {
  return (
    <span
      className={`flex w-full items-center gap-sp-1 border-b-2 border-border-ink ${tint} pinstripes px-sp-2 py-[2px] font-display text-16 uppercase leading-none text-fg-ink`}
    >
      <span aria-hidden="true">{glyph}</span>
      <span>{label}</span>
    </span>
  );
}

export function RetroToaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      // Region offsets per UI-SPEC: desktop sits above the 36px Bottombar;
      // mobile sits above the 56px FAB + safe-area inset.
      offset={{ bottom: "calc(36px + var(--sp-3))", right: "var(--sp-4)" }}
      mobileOffset={{
        bottom: "calc(env(safe-area-inset-bottom) + 56px + var(--sp-4))",
        right: "var(--sp-4)",
      }}
      gap={4}
      closeButton
      // Per-type titlebar label nodes — the semantic stripe + Silkscreen label.
      icons={{
        success: (
          <TitlebarLabel tint="bg-titlebar-mint" glyph="✓" label="DONE" />
        ),
        info: <TitlebarLabel tint="bg-titlebar-blue" glyph="●" label="INFO" />,
        warning: (
          <TitlebarLabel tint="bg-titlebar-butter" glyph="⚠" label="WARN" />
        ),
        error: (
          <TitlebarLabel tint="bg-titlebar-pink" glyph="✕" label="ERROR" />
        ),
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "Dismiss",
        // Default ~5s auto-dismiss for non-danger types; danger overrides to
        // Infinity in retroToast.error. Hover-pause is native to sonner.
        duration: 5000,
        classNames: {
          // The toast panel = a mini Window. Column layout so the titlebar
          // label (icon slot) sits ABOVE the body. radius 0 — square corners.
          toast:
            "retro-toast flex w-[min(360px,calc(100vw-2*var(--sp-4)))] flex-col gap-0 overflow-hidden border-2 border-border-ink bg-bg-panel bevel-raised p-0 font-body text-14 text-fg-ink",
          // Icon slot is the full-width titlebar bar (TitlebarLabel fills it).
          icon: "retro-toast__titlebar m-0 w-full",
          // Body content sits below the titlebar with panel padding.
          content: "flex flex-col gap-sp-1 p-sp-2",
          title: "font-body text-14 leading-snug text-fg-ink",
          description: "font-body text-14 text-fg-muted",
          // Close box: ink-bordered square (radius 0), ≥24px hit target.
          closeButton:
            "retro-toast__close border-2 border-border-ink bg-bg-panel bevel-raised text-fg-ink",
          // Optional action (e.g. UNDO) reuses the bevel button language.
          actionButton:
            "border-2 border-border-ink bg-bg-panel bevel-raised px-sp-2 py-[2px] font-body text-12 uppercase text-fg-ink",
          cancelButton:
            "border-2 border-border-ink bg-bg-panel bevel-raised px-sp-2 py-[2px] font-body text-12 uppercase text-fg-ink",
        },
      }}
    />
  );
}
