/**
 * Tests for useHaptic hook and standalone triggerHaptic function
 *
 * Verifies:
 * - Correct haptic pattern dispatched for tap, success, error
 * - Default pattern is tap
 * - No-op when haptics not supported
 * - Errors from haptic library are silently caught
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Setup mocks before imports
const mockState = vi.hoisted(() => ({
  supportsHaptics: true,
}));

const { mockHaptic } = vi.hoisted(() => ({
  mockHaptic: Object.assign(vi.fn(), {
    confirm: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("ios-haptics", () => ({
  haptic: mockHaptic,
  get supportsHaptics() {
    return mockState.supportsHaptics;
  },
}));

import {
  useHaptic,
  triggerHaptic as standaloneTriggerHaptic,
} from "../use-haptic";

describe("useHaptic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.supportsHaptics = true;
  });

  describe("hook triggerHaptic", () => {
    it.each([
      ["tap", "haptic", () => mockHaptic],
      ["success", "haptic.confirm", () => mockHaptic.confirm],
      ["error", "haptic.error", () => mockHaptic.error],
    ] as const)(
      'calls %s pattern via %s',
      (pattern, _label, getMock) => {
        const { result } = renderHook(() => useHaptic());

        act(() => {
          result.current.triggerHaptic(pattern);
        });

        expect(getMock()).toHaveBeenCalledOnce();
      }
    );

    it("defaults to tap pattern when called without arguments", () => {
      const { result } = renderHook(() => useHaptic());

      act(() => {
        result.current.triggerHaptic();
      });

      expect(mockHaptic).toHaveBeenCalledOnce();
      expect(mockHaptic.confirm).not.toHaveBeenCalled();
      expect(mockHaptic.error).not.toHaveBeenCalled();
    });
  });

  describe("standalone triggerHaptic", () => {
    it.each([
      ["tap", () => mockHaptic],
      ["success", () => mockHaptic.confirm],
      ["error", () => mockHaptic.error],
    ] as const)(
      'calls correct function for %s pattern',
      (pattern, getMock) => {
        standaloneTriggerHaptic(pattern);

        expect(getMock()).toHaveBeenCalledOnce();
      }
    );

    it("defaults to tap pattern when called without arguments", () => {
      standaloneTriggerHaptic();

      expect(mockHaptic).toHaveBeenCalledOnce();
    });
  });

  describe("when haptics not supported", () => {
    it("does not call any haptic function", () => {
      mockState.supportsHaptics = false;

      const { result } = renderHook(() => useHaptic());

      act(() => {
        result.current.triggerHaptic("tap");
        result.current.triggerHaptic("success");
        result.current.triggerHaptic("error");
      });

      expect(mockHaptic).not.toHaveBeenCalled();
      expect(mockHaptic.confirm).not.toHaveBeenCalled();
      expect(mockHaptic.error).not.toHaveBeenCalled();
    });

    it("standalone triggerHaptic also does not call haptic functions", () => {
      mockState.supportsHaptics = false;

      standaloneTriggerHaptic("success");

      expect(mockHaptic.confirm).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("does not propagate errors from haptic library", () => {
      mockHaptic.mockImplementation(() => {
        throw new Error("Haptic hardware failure");
      });

      const { result } = renderHook(() => useHaptic());

      expect(() => {
        act(() => {
          result.current.triggerHaptic("tap");
        });
      }).not.toThrow();
    });

    it("standalone triggerHaptic does not propagate errors", () => {
      mockHaptic.confirm.mockImplementation(() => {
        throw new Error("Haptic hardware failure");
      });

      expect(() => {
        standaloneTriggerHaptic("success");
      }).not.toThrow();
    });
  });
});
