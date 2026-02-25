/**
 * Tests for useTimeFormat hook
 *
 * Verifies:
 * - Time format resolution from user preferences (24h default, 12h, invalid fallback)
 * - Time format string mapping (HH:mm / h:mm a)
 * - formatTime with Date objects, ISO strings, null, undefined, and invalid input
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTimeFormat } from "../use-time-format";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/lib/contexts/auth-context", () => ({
  useAuth: mockUseAuth,
}));

describe("useTimeFormat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("format and timeFormatString resolution", () => {
    it("defaults to 24h with HH:mm when user has no time_format", () => {
      mockUseAuth.mockReturnValue({ user: {} });

      const { result } = renderHook(() => useTimeFormat());

      expect(result.current.format).toBe("24h");
      expect(result.current.timeFormatString).toBe("HH:mm");
    });

    it("uses 12h format with h:mm a when user prefers 12h", () => {
      mockUseAuth.mockReturnValue({ user: { time_format: "12h" } });

      const { result } = renderHook(() => useTimeFormat());

      expect(result.current.format).toBe("12h");
      expect(result.current.timeFormatString).toBe("h:mm a");
    });

    it("falls back to 24h when user has invalid time_format", () => {
      mockUseAuth.mockReturnValue({ user: { time_format: "invalid" } });

      const { result } = renderHook(() => useTimeFormat());

      expect(result.current.format).toBe("24h");
      expect(result.current.timeFormatString).toBe("HH:mm");
    });
  });

  describe("formatTime with 24h format", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { time_format: "24h" } });
    });

    it("formats a Date object to 24h time string", () => {
      const { result } = renderHook(() => useTimeFormat());

      const formatted = result.current.formatTime(new Date(2024, 0, 15, 14, 30));

      expect(formatted).toBe("14:30");
    });

    it("formats an ISO string to 24h time string", () => {
      const { result } = renderHook(() => useTimeFormat());

      const formatted = result.current.formatTime("2024-01-15T14:30:00");

      expect(formatted).toBe("14:30");
    });
  });

  describe("formatTime with 12h format", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { time_format: "12h" } });
    });

    it("formats a Date object to 12h time string", () => {
      const { result } = renderHook(() => useTimeFormat());

      const formatted = result.current.formatTime(new Date(2024, 0, 15, 14, 30));

      expect(formatted).toBe("2:30 PM");
    });

    it("formats an ISO string to 12h time string", () => {
      const { result } = renderHook(() => useTimeFormat());

      const formatted = result.current.formatTime("2024-01-15T14:30:00");

      expect(formatted).toBe("2:30 PM");
    });
  });

  describe("formatTime edge cases", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { time_format: "24h" } });
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
    ])("returns dash for %s input", (_label, input) => {
      const { result } = renderHook(() => useTimeFormat());

      expect(result.current.formatTime(input)).toBe("-");
    });

    it("returns dash for invalid date string", () => {
      const { result } = renderHook(() => useTimeFormat());

      expect(result.current.formatTime("invalid-date")).toBe("-");
    });
  });
});
