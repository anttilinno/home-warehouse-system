// Phase 15 Plan 01 — I18N-03 pure token→string formatters. NO React import: these
// are the deterministic, unit-testable core that the `useDateFormat`/
// `useTimeFormat`/`useNumberFormat` hooks (hooks.ts) wrap. The switch logic mirrors
// RegionalFormatsPage.tsx:70-101 EXACTLY (its option VALUEs are the persisted
// preference tokens — the contract), but operates on a real `new Date(iso)` / real
// number instead of the page's fixed SAMPLE.
//
// UTC decomposition (getUTC*): we read the calendar fields in UTC, MATCHING the
// existing MovementsPanel.formatTimestamp convention, so a rendered timestamp shows
// the same wall-clock the server stored regardless of the viewer's local timezone.
// (Mixing UTC here with local elsewhere would shift days across the date line.)
//
// Invalid input is passed through unchanged (never throws) so a malformed row
// renders its raw string rather than "Invalid Date".

export const DEFAULT_FORMAT_TOKENS = {
  date_format: "YYYY-MM-DD",
  time_format: "HH:mm",
  thousand_separator: " ",
  decimal_separator: ",",
} as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** Format an ISO timestamp to a date string per the persisted `date_format` token. */
export function formatDateToken(iso: string, token?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  switch (token) {
    case "DD/MM/YYYY":
      return `${pad(day)}/${pad(mo)}/${y}`;
    case "MM/DD/YYYY":
      return `${pad(mo)}/${pad(day)}/${y}`;
    case "DD.MM.YYYY":
      return `${pad(day)}.${pad(mo)}.${y}`;
    case "YYYY-MM-DD":
    default:
      return `${y}-${pad(mo)}-${pad(day)}`;
  }
}

/** Format an ISO timestamp to a time string per the persisted `time_format` token. */
export function formatTimeToken(iso: string, token?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  if (token === "h:mm A") {
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(mi)} ${period}`;
  }
  return `${pad(h)}:${pad(mi)}`;
}

export interface NumberSeparators {
  thousand?: string;
  decimal?: string;
}

/**
 * Format a number per the persisted `thousand_separator`/`decimal_separator`
 * tokens. Groups the integer part every 3 digits (mirrors RegionalFormatsPage's
 * regex) and joins the fractional part with the decimal separator. NaN → "".
 */
export function formatNumberToken(n: number, seps?: NumberSeparators): string {
  if (Number.isNaN(n)) return "";
  const thousand = seps?.thousand ?? DEFAULT_FORMAT_TOKENS.thousand_separator;
  const decimal = seps?.decimal ?? DEFAULT_FORMAT_TOKENS.decimal_separator;

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [intPart, fracPart] = String(abs).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousand || "");
  return fracPart ? `${sign}${grouped}${decimal}${fracPart}` : `${sign}${grouped}`;
}

/**
 * Month/year slice for chart axis ticks (Recharts feeds a "YYYY-MM" month key).
 * Returns the leading `YYYY-MM` portion; invalid input passes through. Kept here
 * (not in hooks.ts) because Recharts invokes tickFormatter OUTSIDE React's hook
 * call stack — the axis CANNOT call a hook.
 */
export function formatMonthYearToken(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  return `${y}-${pad(mo)}`;
}
