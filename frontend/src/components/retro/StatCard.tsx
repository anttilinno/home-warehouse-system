import type { ReactNode } from "react";
import { type TitlebarVariant, Window } from "./Window";

const VALUE_TONES = {
  ink: "text-fg-ink",
  danger: "text-accent-pink-deep",
  warn: "text-warn-deep",
} as const;

export type StatValueTone = keyof typeof VALUE_TONES;

export interface StatCardProps {
  /** Metric name shown in the (semantic-colored) titlebar. */
  label: ReactNode;
  /** The big number. Rendered in the pixel display face. */
  value: ReactNode;
  /** Secondary line under the value. */
  sub?: ReactNode;
  titlebarVariant?: TitlebarVariant;
  valueTone?: StatValueTone;
  className?: string;
}

// A small Window whose titlebar carries the metric name; the value is
// Silkscreen 30px (the display-face size floor is 16px — this is well above).
export function StatCard({
  label,
  value,
  sub,
  titlebarVariant = "blue",
  valueTone = "ink",
  className = "",
}: Readonly<StatCardProps>) {
  return (
    <Window
      title={label}
      titlebarVariant={titlebarVariant}
      // `stat-card stat-{variant}` markers let globals.css paint the WHOLE card
      // (body + header tint + number) in dark terminal mode — the only colored
      // panels in dark (other Windows keep the neutral titlebar).
      className={`stat-card stat-${titlebarVariant} ${className}`.trim()}
      bodyClassName="px-sp-4 py-sp-3"
    >
      <div
        className={`stat-card__value font-display text-30 leading-[1.15] uppercase ${VALUE_TONES[valueTone]}`}
      >
        {value}
      </div>
      {sub && <div className="text-12 text-fg-muted">{sub}</div>}
    </Window>
  );
}
