import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Stub @/lib/scanner feedback surface. feedback.ts itself is covered by
// Plan 03; this is a unit test of the hook contract.
const resumeAudioContextMock = vi.fn<() => void>();
const triggerScanFeedbackMock = vi.fn<() => void>();

vi.mock("@/lib/scanner", () => ({
  resumeAudioContext: () => resumeAudioContextMock(),
  triggerScanFeedback: () => triggerScanFeedbackMock(),
}));

import { useScanFeedback } from "../useScanFeedback";

describe("useScanFeedback (D-08 ref-guarded AudioContext prime)", () => {
  beforeEach(() => {
    resumeAudioContextMock.mockReset();
    triggerScanFeedbackMock.mockReset();
  });

  it("prime() calls resumeAudioContext exactly once on first invocation", () => {
    const { result } = renderHook(() => useScanFeedback());
    act(() => {
      result.current.prime();
    });
    expect(resumeAudioContextMock).toHaveBeenCalledTimes(1);
  });

  it("prime() is idempotent — 3 calls still result in 1 resumeAudioContext call", () => {
    const { result } = renderHook(() => useScanFeedback());
    act(() => {
      result.current.prime();
      result.current.prime();
      result.current.prime();
    });
    expect(resumeAudioContextMock).toHaveBeenCalledTimes(1);
  });

  it("a fresh mount has a fresh primedRef — prime() on the new instance calls resumeAudioContext again", () => {
    const first = renderHook(() => useScanFeedback());
    act(() => {
      first.result.current.prime();
    });
    expect(resumeAudioContextMock).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderHook(() => useScanFeedback());
    act(() => {
      second.result.current.prime();
    });
    // Second mount's ref is fresh → resume fires again.
    expect(resumeAudioContextMock).toHaveBeenCalledTimes(2);
  });

  it("trigger() calls triggerScanFeedback exactly once per invocation", () => {
    const { result } = renderHook(() => useScanFeedback());
    act(() => {
      result.current.trigger();
    });
    expect(triggerScanFeedbackMock).toHaveBeenCalledTimes(1);
  });

  it("trigger() is NOT idempotent — each call fires triggerScanFeedback", () => {
    const { result } = renderHook(() => useScanFeedback());
    act(() => {
      result.current.trigger();
      result.current.trigger();
      result.current.trigger();
    });
    expect(triggerScanFeedbackMock).toHaveBeenCalledTimes(3);
  });

  it("prime and trigger are stable across rerenders (useCallback with empty deps)", () => {
    const { result, rerender } = renderHook(() => useScanFeedback());
    const primeBefore = result.current.prime;
    const triggerBefore = result.current.trigger;
    rerender();
    expect(result.current.prime).toBe(primeBefore);
    expect(result.current.trigger).toBe(triggerBefore);
  });
});
