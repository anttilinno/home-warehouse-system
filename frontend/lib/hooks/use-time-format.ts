"use client";

import { useCallback, useMemo } from "react";
import { format as dateFnsFormat, parseISO, isValid } from "date-fns";
import { useAuth } from "@/lib/contexts/auth-context";

// Supported time formats
export type TimeFormatOption = "12h" | "24h";

// Default format if not set
const DEFAULT_TIME_FORMAT: TimeFormatOption = "24h";

// Map time format options to date-fns format strings
const TIME_FORMAT_MAP: Record<TimeFormatOption, string> = {
  "12h": "h:mm a",
  "24h": "HH:mm",
};

export interface UseTimeFormatReturn {
  /** User's selected time format (e.g., "24h") */
  format: TimeFormatOption;
  /** Format a date's time according to user preference */
  formatTime: (date: Date | string | null | undefined) => string;
  /** Get date-fns time format string for custom formatting */
  timeFormatString: string;
}

/**
 * Hook for formatting times according to user's preference.
 *
 * @example
 * const { formatTime } = useTimeFormat();
 * return <span>{formatTime(item.created_at)}</span>;
 */
export function useTimeFormat(): UseTimeFormatReturn {
  const { user } = useAuth();

  // Get user's format preference, fallback to default
  const format = useMemo<TimeFormatOption>(() => {
    const userFormat = user?.time_format;
    if (userFormat === "12h" || userFormat === "24h") {
      return userFormat;
    }
    return DEFAULT_TIME_FORMAT;
  }, [user?.time_format]);

  // Get date-fns format string
  const timeFormatString = TIME_FORMAT_MAP[format];

  const formatTime = useCallback(
    (date: Date | string | null | undefined): string => {
      if (!date) return "-";

      try {
        const dateObj = typeof date === "string" ? parseISO(date) : date;
        if (!isValid(dateObj)) return "-";
        return dateFnsFormat(dateObj, timeFormatString);
      } catch {
        return "-";
      }
    },
    [timeFormatString]
  );

  return {
    format,
    formatTime,
    timeFormatString,
  };
}
