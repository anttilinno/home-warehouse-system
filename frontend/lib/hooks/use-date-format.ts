"use client";

import { useCallback, useMemo } from "react";
import { format as dateFnsFormat, parse, parseISO, isValid } from "date-fns";
import { useAuth } from "@/lib/contexts/auth-context";

// Supported date formats (can be preset or custom string)
export type DateFormatOption = "MM/DD/YY" | "DD/MM/YYYY" | "YYYY-MM-DD" | string;

// Preset formats
export type PresetDateFormat = "MM/DD/YY" | "DD/MM/YYYY" | "YYYY-MM-DD";

// Map user-friendly format strings to date-fns format strings
const FORMAT_MAP: Record<PresetDateFormat, string> = {
  "MM/DD/YY": "MM/dd/yy",
  "DD/MM/YYYY": "dd/MM/yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
};

// Map format strings to lowercase placeholder strings
const PLACEHOLDER_MAP: Record<PresetDateFormat, string> = {
  "MM/DD/YY": "mm/dd/yy",
  "DD/MM/YYYY": "dd/mm/yyyy",
  "YYYY-MM-DD": "yyyy-mm-dd",
};

// Default format if not set
const DEFAULT_FORMAT: PresetDateFormat = "YYYY-MM-DD";

export interface UseDateFormatReturn {
  /** User's selected format (e.g., "MM/DD/YY") */
  format: DateFormatOption;
  /** Format a date according to user preference */
  formatDate: (date: Date | string | null | undefined) => string;
  /** Format a date with time according to user preference */
  formatDateTime: (date: Date | string | null | undefined) => string;
  /** Get date-fns format string for custom formatting */
  dateFnsFormat: string;
  /** Parse a date string according to user's format preference */
  parseDate: (dateString: string) => Date | null;
  /** Lowercase placeholder for user's format (e.g., "dd/mm/yyyy") */
  placeholder: string;
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
    if (userFormat && (FORMAT_MAP[userFormat as PresetDateFormat] || userFormat)) {
      return userFormat;
    }
    return DEFAULT_FORMAT;
  }, [user?.date_format]);

  // Get date-fns format string (use preset map or custom format string)
  const dateFnsFormatStr = FORMAT_MAP[format as PresetDateFormat] || format;

  // Get placeholder string
  const placeholder = useMemo(() => {
    return PLACEHOLDER_MAP[format as PresetDateFormat] || format.toLowerCase();
  }, [format]);

  const parseDate = useCallback(
    (dateString: string): Date | null => {
      if (!dateString || !dateString.trim()) return null;

      try {
        const parsed = parse(dateString, dateFnsFormatStr, new Date());
        if (!isValid(parsed)) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    [dateFnsFormatStr]
  );

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
    parseDate,
    placeholder,
  };
}
