/**
 * Tests for useDateFormat hook
 *
 * Verifies:
 * - Date format resolution from user preferences (YYYY-MM-DD default, MM/DD/YY, DD/MM/YYYY)
 * - Placeholder strings for each preset
 * - formatDate with Date objects, ISO strings, null, undefined, and invalid input
 * - formatDateTime combining date and time format
 * - parseDate with valid and invalid strings
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDateFormat } from "../use-date-format";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/lib/contexts/auth-context", () => ({
  useAuth: mockUseAuth,
}));

describe("useDateFormat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("YYYY-MM-DD preset (default)", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: {} });
    });

    it("uses YYYY-MM-DD format and yyyy-mm-dd placeholder by default", () => {
      const { result } = renderHook(() => useDateFormat());

      expect(result.current.format).toBe("YYYY-MM-DD");
      expect(result.current.placeholder).toBe("yyyy-mm-dd");
    });

    it("formats a Date object as yyyy-MM-dd", () => {
      const { result } = renderHook(() => useDateFormat());

      expect(result.current.formatDate(new Date(2024, 0, 15))).toBe("2024-01-15");
    });
  });

  describe("MM/DD/YY preset", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { date_format: "MM/DD/YY" } });
    });

    it("uses mm/dd/yy placeholder", () => {
      const { result } = renderHook(() => useDateFormat());

      expect(result.current.format).toBe("MM/DD/YY");
      expect(result.current.placeholder).toBe("mm/dd/yy");
    });

    it("formats a Date object as MM/dd/yy", () => {
      const { result } = renderHook(() => useDateFormat());

      expect(result.current.formatDate(new Date(2024, 0, 15))).toBe("01/15/24");
    });
  });

  describe("DD/MM/YYYY preset", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { date_format: "DD/MM/YYYY" } });
    });

    it("uses dd/mm/yyyy placeholder", () => {
      const { result } = renderHook(() => useDateFormat());

      expect(result.current.format).toBe("DD/MM/YYYY");
      expect(result.current.placeholder).toBe("dd/mm/yyyy");
    });

    it("formats a Date object as dd/MM/yyyy", () => {
      const { result } = renderHook(() => useDateFormat());

      expect(result.current.formatDate(new Date(2024, 0, 15))).toBe("15/01/2024");
    });
  });

  describe("formatDate edge cases", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: {} });
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
    ])("returns dash for %s input", (_label, input) => {
      const { result } = renderHook(() => useDateFormat());

      expect(result.current.formatDate(input)).toBe("-");
    });

    it("returns dash for invalid date string", () => {
      const { result } = renderHook(() => useDateFormat());

      expect(result.current.formatDate("invalid")).toBe("-");
    });

    it("formats an ISO string correctly", () => {
      const { result } = renderHook(() => useDateFormat());

      expect(result.current.formatDate("2024-01-15T14:30:00")).toBe("2024-01-15");
    });
  });

  describe("formatDateTime", () => {
    it("combines date and default 24h time format", () => {
      mockUseAuth.mockReturnValue({ user: { date_format: "YYYY-MM-DD" } });

      const { result } = renderHook(() => useDateFormat());

      expect(result.current.formatDateTime(new Date(2024, 0, 15, 14, 30))).toBe(
        "2024-01-15 14:30"
      );
    });

    it("combines date and 12h time format when user prefers 12h", () => {
      mockUseAuth.mockReturnValue({
        user: { date_format: "YYYY-MM-DD", time_format: "12h" },
      });

      const { result } = renderHook(() => useDateFormat());

      expect(result.current.formatDateTime(new Date(2024, 0, 15, 14, 30))).toBe(
        "2024-01-15 2:30 PM"
      );
    });

    it("returns dash for null input", () => {
      mockUseAuth.mockReturnValue({ user: {} });

      const { result } = renderHook(() => useDateFormat());

      expect(result.current.formatDateTime(null)).toBe("-");
    });
  });

  describe("parseDate", () => {
    it("parses a valid date string according to YYYY-MM-DD format", () => {
      mockUseAuth.mockReturnValue({ user: { date_format: "YYYY-MM-DD" } });

      const { result } = renderHook(() => useDateFormat());
      const parsed = result.current.parseDate("2024-01-15");

      expect(parsed).toBeInstanceOf(Date);
      expect(parsed!.getFullYear()).toBe(2024);
      expect(parsed!.getMonth()).toBe(0);
      expect(parsed!.getDate()).toBe(15);
    });

    it("returns null for invalid date string", () => {
      mockUseAuth.mockReturnValue({ user: {} });

      const { result } = renderHook(() => useDateFormat());

      expect(result.current.parseDate("invalid")).toBe(null);
    });

    it("returns null for empty string", () => {
      mockUseAuth.mockReturnValue({ user: {} });

      const { result } = renderHook(() => useDateFormat());

      expect(result.current.parseDate("")).toBe(null);
    });
  });
});
