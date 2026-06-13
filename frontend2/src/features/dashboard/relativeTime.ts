import { i18n } from "@/lib/i18n";

// DASH-02 part a: a pure, locale-aware relative-time formatter for the recent
// activity table. Under 24h the cell reads "Nm ago" / "Nh ago" (or "<1m" for
// the freshest events); at/after 24h it falls back to an ABSOLUTE date+time so
// older rows never misleadingly read as "today". `now` is injectable so the
// boundaries are unit-testable without freezing the system clock.
//
// Future/negative deltas (clock skew between client + server) are clamped to
// "<1m" rather than rendering a nonsensical negative interval.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const delta = now.getTime() - date.getTime();

  // Clock skew / future timestamp → treat as just-now.
  if (delta < MINUTE_MS) {
    return "<1m";
  }

  if (delta < HOUR_MS) {
    const m = Math.floor(delta / MINUTE_MS);
    return `${m}m ago`;
  }

  if (delta < DAY_MS) {
    const h = Math.floor(delta / HOUR_MS);
    return `${h}h ago`;
  }

  // At/after 24h → absolute date + time (same shape the old same-day helper
  // used for non-today rows, now always with the date component).
  return date.toLocaleString(i18n.locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
