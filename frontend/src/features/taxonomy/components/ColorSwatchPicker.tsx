import { useLingui } from "@lingui/react/macro";

// Phase 10 Plan 04 (TAX-07) — the fixed on-palette color picker for labels.
// UI-SPEC §Label manager: a fixed swatch palette drawn from the shipped pastel +
// deep tokens (NOT a free <input type=color> — keeps labels on-palette, AA-safe).
// The 8 system colors are clickable swatches; a "no color" option is allowed.
//
// The component stores the RESOLVED HEX value (not the token name) so the backend
// receives `#RRGGBB` matching its `^#[0-9A-Fa-f]{6}$` pattern (label/handler.go).
// Each swatch is a focusable <button> with a MANDATORY 1px ink border (cue #3 —
// a pale/white swatch stays visible). Selected → 2px ink ring + ✓ glyph.
// Controlled value/onChange so it drops into a RHF Controller.

// The 8 on-palette swatches (UI-SPEC §Label manager) → resolved hex from
// styles/tokens.css. Stored value is the hex (backend wants #RRGGBB), never the
// token name. `token` names the source CSS var: ColorSwatchPicker.test.ts parses
// tokens.css and asserts hex === var, so the two copies cannot drift (the old
// "Deep mint" had silently desynced to #1e6b43 after the AA nudge of
// --accent-mint-deep — that class of regression now fails the test).
export interface Swatch {
  /** The `--<token>` CSS var in tokens.css this swatch mirrors. */
  token: string;
  hex: string;
  label: string;
}

export const SWATCHES: Swatch[] = [
  { token: "titlebar-blue", hex: "#b8d8e8", label: "Sky blue" },
  { token: "titlebar-pink", hex: "#f4b8c4", label: "Pink" },
  { token: "titlebar-mint", hex: "#b8e0c8", label: "Mint" },
  { token: "titlebar-butter", hex: "#f6e3a8", label: "Butter" },
  { token: "accent-blue-deep", hex: "#19526f", label: "Deep blue" },
  { token: "accent-pink-deep", hex: "#a8334f", label: "Deep pink" },
  { token: "accent-mint-deep", hex: "#1a5e3a", label: "Deep mint" },
  { token: "danger", hex: "#b73348", label: "Danger red" },
];

export interface ColorSwatchPickerProps {
  /** Currently-selected hex, or "" / undefined for the no-color option. */
  value?: string;
  /** Fired with the chosen hex, or undefined for "no color". */
  onChange: (hex: string | undefined) => void;
  /** Accessible group label. */
  label?: string;
}

export function ColorSwatchPicker({
  value,
  onChange,
  label,
}: ColorSwatchPickerProps) {
  const { t } = useLingui();
  // Normalize for case-insensitive selection compare (hex may arrive uppercased).
  const current = (value ?? "").toLowerCase();
  const groupLabel = label ?? t`Color`;

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex flex-wrap items-center gap-sp-2"
    >
      {/* No-color option — neutral panel swatch (still a 1px ink border). */}
      {(() => {
        const selected = current === "";
        return (
          <button
            type="button"
            aria-label={t`No color`}
            aria-pressed={selected}
            onClick={() => onChange(undefined)}
            className={`relative flex h-[28px] w-[28px] items-center justify-center bg-bg-panel-2 ${
              selected
                ? "outline outline-2 outline-offset-1 outline-border-ink"
                : ""
            } border border-border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-ink`}
          >
            {/* diagonal slash hints "none" without relying on color alone */}
            <span aria-hidden="true" className="text-14 text-fg-muted">
              {selected ? "✓" : "∅"}
            </span>
          </button>
        );
      })()}

      {SWATCHES.map((s) => {
        const selected = current === s.hex.toLowerCase();
        return (
          <button
            key={s.hex}
            type="button"
            aria-label={s.label}
            aria-pressed={selected}
            onClick={() => onChange(s.hex)}
            style={{ backgroundColor: s.hex }}
            className={`relative flex h-[28px] w-[28px] items-center justify-center ${
              selected
                ? "outline outline-2 outline-offset-1 outline-border-ink"
                : ""
            } border border-border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-ink`}
          >
            {selected && (
              // Ink check on a 1px panel chip so it reads on any swatch hue.
              <span
                aria-hidden="true"
                className="rounded-[2px] border border-border-ink bg-bg-panel px-[2px] text-11 leading-none text-fg-ink"
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
