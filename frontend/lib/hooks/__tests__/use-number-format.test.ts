/**
 * Tests for useNumberFormat hook
 *
 * Verifies:
 * - Separator resolution from user preferences (defaults, European, space)
 * - formatNumber with various decimal options and large numbers
 * - parseNumber round-trip and invalid input handling
 * - Fallback to defaults for invalid separator preferences
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNumberFormat } from "../use-number-format";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/lib/contexts/auth-context", () => ({
  useAuth: mockUseAuth,
}));

describe("useNumberFormat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("separator resolution", () => {
    it("defaults to comma thousand and dot decimal when user has no prefs", () => {
      mockUseAuth.mockReturnValue({ user: {} });

      const { result } = renderHook(() => useNumberFormat());

      expect(result.current.thousandSeparator).toBe(",");
      expect(result.current.decimalSeparator).toBe(".");
    });

    it("falls back to defaults for invalid separator preferences", () => {
      mockUseAuth.mockReturnValue({
        user: { thousand_separator: "X", decimal_separator: "Y" },
      });

      const { result } = renderHook(() => useNumberFormat());

      expect(result.current.thousandSeparator).toBe(",");
      expect(result.current.decimalSeparator).toBe(".");
    });
  });

  describe("formatNumber with default separators", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: {} });
    });

    it("formats integer without decimals param", () => {
      const { result } = renderHook(() => useNumberFormat());

      expect(result.current.formatNumber(1234)).toBe("1,234");
    });

    it("formats with explicit decimal places", () => {
      const { result } = renderHook(() => useNumberFormat());

      expect(result.current.formatNumber(1234567.89, 2)).toBe("1,234,567.89");
    });

    it("rounds when decimals=0", () => {
      const { result } = renderHook(() => useNumberFormat());

      expect(result.current.formatNumber(1234.56, 0)).toBe("1,235");
    });

    it("formats large numbers with thousand separators", () => {
      const { result } = renderHook(() => useNumberFormat());

      expect(result.current.formatNumber(1234567890, 0)).toBe("1,234,567,890");
    });
  });

  describe("formatNumber with European separators", () => {
    it("uses dot for thousands and comma for decimal", () => {
      mockUseAuth.mockReturnValue({
        user: { thousand_separator: ".", decimal_separator: "," },
      });

      const { result } = renderHook(() => useNumberFormat());

      expect(result.current.formatNumber(1234.56, 2)).toBe("1.234,56");
    });
  });

  describe("formatNumber with space thousand separator", () => {
    it("uses space for thousands and dot for decimal", () => {
      mockUseAuth.mockReturnValue({
        user: { thousand_separator: " ", decimal_separator: "." },
      });

      const { result } = renderHook(() => useNumberFormat());

      expect(result.current.formatNumber(1234.56, 2)).toBe("1 234.56");
    });
  });

  describe("parseNumber", () => {
    it("round-trips formatNumber back to original number", () => {
      mockUseAuth.mockReturnValue({ user: {} });

      const { result } = renderHook(() => useNumberFormat());

      const formatted = result.current.formatNumber(1234567.89, 2);
      const parsed = result.current.parseNumber(formatted);

      expect(parsed).toBe(1234567.89);
    });

    it("round-trips with European separators", () => {
      mockUseAuth.mockReturnValue({
        user: { thousand_separator: ".", decimal_separator: "," },
      });

      const { result } = renderHook(() => useNumberFormat());

      const formatted = result.current.formatNumber(1234567.89, 2);
      const parsed = result.current.parseNumber(formatted);

      expect(parsed).toBe(1234567.89);
    });

    it("returns null for non-numeric string", () => {
      mockUseAuth.mockReturnValue({ user: {} });

      const { result } = renderHook(() => useNumberFormat());

      expect(result.current.parseNumber("abc")).toBe(null);
    });
  });
});
