"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@/lib/contexts/auth-context";

// Supported separator options
export type ThousandSeparator = "," | "." | " ";
export type DecimalSeparator = "." | ",";

// Default separators if not set
const DEFAULT_THOUSAND_SEP: ThousandSeparator = ",";
const DEFAULT_DECIMAL_SEP: DecimalSeparator = ".";

// Valid values for validation
const VALID_THOUSAND_SEPS: string[] = [",", ".", " "];
const VALID_DECIMAL_SEPS: string[] = [".", ","];

export interface UseNumberFormatReturn {
  /** User's selected thousand separator */
  thousandSeparator: ThousandSeparator;
  /** User's selected decimal separator */
  decimalSeparator: DecimalSeparator;
  /** Format a number according to user preference */
  formatNumber: (value: number, decimals?: number) => string;
  /** Parse a formatted number string back to a number (returns null if invalid) */
  parseNumber: (formatted: string) => number | null;
}

/**
 * Hook for formatting numbers according to user's separator preferences.
 *
 * @example
 * const { formatNumber, parseNumber } = useNumberFormat();
 * return <span>{formatNumber(1234.56, 2)}</span>; // "1,234.56" (default)
 */
export function useNumberFormat(): UseNumberFormatReturn {
  const { user } = useAuth();

  // Get user's thousand separator preference, fallback to default
  const thousandSeparator = useMemo<ThousandSeparator>(() => {
    const userSep = user?.thousand_separator;
    if (userSep && VALID_THOUSAND_SEPS.includes(userSep)) {
      return userSep as ThousandSeparator;
    }
    return DEFAULT_THOUSAND_SEP;
  }, [user?.thousand_separator]);

  // Get user's decimal separator preference, fallback to default
  const decimalSeparator = useMemo<DecimalSeparator>(() => {
    const userSep = user?.decimal_separator;
    if (userSep && VALID_DECIMAL_SEPS.includes(userSep)) {
      return userSep as DecimalSeparator;
    }
    return DEFAULT_DECIMAL_SEP;
  }, [user?.decimal_separator]);

  const formatNumber = useCallback(
    (value: number, decimals?: number): string => {
      try {
        const str = decimals !== undefined ? value.toFixed(decimals) : value.toString();
        const parts = str.split(".");

        // Apply thousand separator to integer part
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);

        // Join with decimal separator if decimal part exists
        if (parts.length > 1) {
          return parts[0] + decimalSeparator + parts[1];
        }

        return parts[0];
      } catch {
        return String(value);
      }
    },
    [thousandSeparator, decimalSeparator]
  );

  const parseNumber = useCallback(
    (formatted: string): number | null => {
      try {
        // Remove all thousand separators
        let cleaned = formatted.replaceAll(thousandSeparator, "");

        // Replace decimal separator with standard period
        if (decimalSeparator !== ".") {
          cleaned = cleaned.replace(decimalSeparator, ".");
        }

        const num = Number(cleaned);
        return isNaN(num) ? null : num;
      } catch {
        return null;
      }
    },
    [thousandSeparator, decimalSeparator]
  );

  return {
    thousandSeparator,
    decimalSeparator,
    formatNumber,
    parseNumber,
  };
}
