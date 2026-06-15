import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { RetroBadge, Window } from "@/components/retro";
import type { ThemePref } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";

// Dark Mode P1 — AppearancePage (SETT-04 / SETT-11). Rewritten from the locked
// light-only card into a Light / Dark / System selector wired to useTheme
// (localStorage `hws-theme`). The selected card keeps the THREE non-color cues
// of the original (a ◉ glyph, the filled bevel-pressed treatment, and the
// CURRENT badge) so "current" stays legible without relying on color alone.

interface ThemeOption {
  value: ThemePref;
  label: ReactNode;
  desc: ReactNode;
}

const OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: <Trans>Light</Trans>,
    desc: <Trans>Retro OS Pastel — cream desktop, white panels.</Trans>,
  },
  {
    value: "dark",
    label: <Trans>Dark</Trans>,
    desc: <Trans>The same chrome on a dark desktop and panels.</Trans>,
  },
  {
    value: "system",
    label: <Trans>System</Trans>,
    desc: <Trans>Follow the operating system setting.</Trans>,
  },
];

export function AppearancePage() {
  const { pref, setPref } = useTheme();

  return (
    <Window
      title={<Trans>Appearance</Trans>}
      bodyClassName="grid gap-sp-4 p-sp-4"
    >
      <p className="text-12 font-bold uppercase tracking-8 text-fg-muted">
        <Trans>Theme</Trans>
      </p>

      <div role="radiogroup" aria-label="Theme" className="grid gap-sp-3">
        {OPTIONS.map((opt) => {
          const selected = pref === opt.value;
          return (
            // A native radio can't carry the retro card chrome; a button with
            // role="radio" in the radiogroup is the accessible custom pattern.
            // biome-ignore lint/a11y/useSemanticElements: explained above
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPref(opt.value)}
              className={`flex cursor-pointer items-start gap-sp-3 border-2 border-border-ink px-sp-3 py-sp-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2 ${
                selected
                  ? "bg-titlebar-blue bevel-pressed"
                  : "bg-bg-panel bevel-raised"
              }`}
            >
              <span
                aria-hidden="true"
                className="mt-px flex-none text-16 leading-none"
              >
                {selected ? "◉" : "◯"}
              </span>
              <span className="flex flex-1 flex-col gap-sp-1">
                <span className="flex items-center gap-sp-2">
                  <span className="text-14 font-bold">{opt.label}</span>
                  {selected && (
                    <RetroBadge variant="info">
                      <Trans>CURRENT</Trans>
                    </RetroBadge>
                  )}
                </span>
                <span className="text-12 opacity-80">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Window>
  );
}
