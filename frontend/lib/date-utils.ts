/**
 * Date formatting utilities that respect user's date/time format preference.
 *
 * Supported formats:
 * - "DD.MM.YYYY HH:mm" - European (24h)
 * - "MM/DD/YYYY h:mm A" - US (12h AM/PM)
 * - "YYYY-MM-DD HH:mm" - ISO (24h)
 */

const DEFAULT_FORMAT = "DD.MM.YYYY HH:mm";

/**
 * Format a date string with both date and time according to user preference.
 */
export function formatDateTime(dateString: string, format: string = DEFAULT_FORMAT): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours24 >= 12 ? "PM" : "AM";

  switch (format) {
    case "MM/DD/YYYY h:mm A":
      return `${month}/${day}/${year} ${hours12}:${minutes} ${ampm}`;
    case "YYYY-MM-DD HH:mm":
      return `${year}-${month}-${day} ${hours24.toString().padStart(2, "0")}:${minutes}`;
    case "DD.MM.YYYY HH:mm":
    default:
      return `${day}.${month}.${year} ${hours24.toString().padStart(2, "0")}:${minutes}`;
  }
}

/**
 * Format a date string with date only (no time) according to user preference.
 */
export function formatDate(dateString: string, format: string = DEFAULT_FORMAT): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  switch (format) {
    case "MM/DD/YYYY h:mm A":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD HH:mm":
      return `${year}-${month}-${day}`;
    case "DD.MM.YYYY HH:mm":
    default:
      return `${day}.${month}.${year}`;
  }
}
