/**
 * Helpers for "expiring soon" logic (inventory expiration dates and warranty
 * end dates). Mirrors the backend windows: an entry is "expiring soon" when
 * its date falls between today and today + N days (default 30).
 */

export const DEFAULT_EXPIRY_WINDOW_DAYS = 30;

/** Whole calendar days from today until the given YYYY-MM-DD / ISO date. */
export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((utcDate - utcToday) / 86_400_000);
}

/** True when the date is between today and today + days (inclusive). */
export function isExpiringWithin(
  dateStr: string | null | undefined,
  days: number = DEFAULT_EXPIRY_WINDOW_DAYS
): boolean {
  const d = daysUntil(dateStr);
  return d !== null && d >= 0 && d <= days;
}
