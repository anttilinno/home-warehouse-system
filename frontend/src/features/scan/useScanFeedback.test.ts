// useScanFeedback — beep + haptic + visual-flash trigger, reduced-motion aware
// (RESEARCH Pattern 5 / SCAN-03). renderHook with mocked beep + ios-haptics.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock the 11-02 beep surface (the barrel) so we assert beep calls without audio.
const playSuccessBeep = vi.fn();
const playErrorBeep = vi.fn();
const primeAudioMock = vi.fn();
vi.mock("@/lib/scanner", () => ({
  playSuccessBeep: () => playSuccessBeep(),
  playErrorBeep: () => playErrorBeep(),
  primeAudio: () => primeAudioMock(),
}));

// Mock ios-haptics (supportsHaptics gate; no UA branching — Pattern 5).
const hapticConfirm = vi.fn();
const hapticError = vi.fn();
let supportsHapticsValue = true;
vi.mock("ios-haptics", () => ({
  get supportsHaptics() {
    return supportsHapticsValue;
  },
  haptic: Object.assign(() => {}, {
    confirm: () => hapticConfirm(),
    error: () => hapticError(),
  }),
}));

import { useScanFeedback } from "./useScanFeedback";

function setReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("reduce") ? reduce : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  supportsHapticsValue = true;
  setReducedMotion(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useScanFeedback", () => {
  it("success() fires the success beep + haptic.confirm() + a visual-flash signal", () => {
    const { result } = renderHook(() => useScanFeedback());

    act(() => {
      result.current.success();
    });

    expect(playSuccessBeep).toHaveBeenCalledTimes(1);
    expect(hapticConfirm).toHaveBeenCalledTimes(1);
    // The visual flash is exposed as a bumped signal the component watches.
    expect(result.current.flash).toBe(1);
  });

  it("error() fires the error beep + haptic.error()", () => {
    const { result } = renderHook(() => useScanFeedback());

    act(() => {
      result.current.error();
    });

    expect(playErrorBeep).toHaveBeenCalledTimes(1);
    expect(hapticError).toHaveBeenCalledTimes(1);
  });

  it("does not call haptics when supportsHaptics is false", () => {
    supportsHapticsValue = false;
    const { result } = renderHook(() => useScanFeedback());

    act(() => {
      result.current.success();
    });

    expect(playSuccessBeep).toHaveBeenCalledTimes(1); // beep still fires
    expect(hapticConfirm).not.toHaveBeenCalled();
  });

  it("exposes reducedMotion=true under prefers-reduced-motion (static-checkmark variant)", () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useScanFeedback());
    expect(result.current.reducedMotion).toBe(true);
  });

  it("exposes reducedMotion=false when motion is allowed", () => {
    setReducedMotion(false);
    const { result } = renderHook(() => useScanFeedback());
    expect(result.current.reducedMotion).toBe(false);
  });

  it("primeAudio() delegates to the lib primeAudio (pointerdown unlock)", () => {
    const { result } = renderHook(() => useScanFeedback());
    act(() => {
      result.current.primeAudio();
    });
    expect(primeAudioMock).toHaveBeenCalledTimes(1);
  });
});
