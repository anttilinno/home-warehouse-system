"use client";

import { useCallback, useMemo } from "react";
import { format as dateFnsFormat, parseISO, isValid } from "date-fns";
import { useAuth } from "@/lib/contexts/auth-context";

// Supported date formats
export type DateFormatOption = "MM/DD/YY" | "DD/MM/YYYY" | "YYYY-MM-DD";

// Map user-friendly format strings to date-fns format strings
const FORMAT_MAP: Record<DateFormatOption, string> = {
  "MM/DD/YY": "MM/dd/yy",
  "DD/MM/YYYY": "dd/MM/yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
};

// Default format if not set
const DEFAULT_FORMAT: DateFormatOption = "YYYY-MM-DD";

export interface UseDateFormatReturn {
  /** User's selected format (e.g., "MM/DD/YY") */
  format: DateFormatOption;
  /** Format a date according to user preference */
  formatDate: (date: Date | string | null | undefined) => string;
  /** Format a date with time according to user preference */
  formatDateTime: (date: Date | string | null | undefined) => string;
  /** Get date-fns format string for custom formatting */
  dateFnsFormat: string;
}

/**
 * Hook for formatting dates according to user's preference.
 *
 * @example
 * const { formatDate } = useDateFormat();
 * return <span>{formatDate(item.created_at)}</span>;
 */
export function useDateFormat(): UseDateFormatReturn {
  const { user } = useAuth();

  // Get user's format preference, fallback to default
  const format = useMemo<DateFormatOption>(() => {
    const userFormat = user?.date_format as DateFormatOption | undefined;
    if (userFormat && FORMAT_MAP[userFormat]) {
      return userFormat;
    }
    return DEFAULT_FORMAT;
  }, [user?.date_format]);

  const dateFnsFormatStr = FORMAT_MAP[format];

  const formatDate = useCallback(
    (date: Date | string | null | undefined): string => {
      if (!date) return "-";

      try {
        const dateObj = typeof date === "string" ? parseISO(date) : date;
        if (!isValid(dateObj)) return "-";
        return dateFnsFormat(dateObj, dateFnsFormatStr);
      } catch {
        return "-";
      }
    },
    [dateFnsFormatStr]
  );

  const formatDateTime = useCallback(
    (date: Date | string | null | undefined): string => {
      if (!date) return "-";

      try {
        const dateObj = typeof date === "string" ? parseISO(date) : date;
        if (!isValid(dateObj)) return "-";
        // Add time component to date format
        return dateFnsFormat(dateObj, `${dateFnsFormatStr} HH:mm`);
      } catch {
        return "-";
      }
    },
    [dateFnsFormatStr]
  );

  return {
    format,
    formatDate,
    formatDateTime,
    dateFnsFormat: dateFnsFormatStr,
  };
}
