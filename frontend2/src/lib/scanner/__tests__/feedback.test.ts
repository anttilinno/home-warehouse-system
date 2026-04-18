/**
 * Unit tests for lib/scanner/feedback.ts
 *
 * Covers SCAN-03 behaviors at the module layer:
 * - initAudioContext idempotency + SSR-safety
 * - resumeAudioContext (added in Phase 64 for iOS gesture-unlock, D-08)
 * - playSuccessBeep @ 880 Hz × 100 ms
 * - triggerHaptic via navigator.vibrate (D-17: no ios-haptics)
 * - triggerScanFeedback composition (beep + haptic)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Types for the fake oscillator/gain captured across tests
interface FakeAudioParam {
  value: number;
}
interface FakeOscillator {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  frequency: FakeAudioParam;
  type: string;
  onended: null | (() => void);
}
interface FakeGain {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  gain: FakeAudioParam;
}

function makeFakeAudioContext(state: "running" | "suspended" = "running") {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];
  const resume = vi.fn(() => Promise.resolve());

  const ctx = {
    state,
    currentTime: 0,
    destination: {} as unknown as AudioDestinationNode,
    resume,
    createOscillator: vi.fn((): FakeOscillator => {
      const osc: FakeOscillator = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: { value: 0 },
        type: "sine",
        onended: null,
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn((): FakeGain => {
      const g: FakeGain = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 0 },
      };
      gains.push(g);
      return g;
    }),
  };
  return { ctx, oscillators, gains, resume };
}

describe("lib/scanner/feedback", () => {
  let ctxHarness: ReturnType<typeof makeFakeAudioContext>;

  beforeEach(async () => {
    // Reset the module so its module-scope singletons (audioContext,
    // audioInitialized) are fresh per test.
    vi.resetModules();
    ctxHarness = makeFakeAudioContext("running");
    // vi.fn() with an arrow factory is not `new`-callable; use a function
    // expression so `new AudioContextClass()` succeeds.
    const FakeAudioContext = vi.fn(function (this: unknown) {
      return ctxHarness.ctx;
    });
    vi.stubGlobal("AudioContext", FakeAudioContext);
    // Some UA paths check webkitAudioContext; default window already has
    // AudioContext, so no explicit webkit stub needed here.
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("Test 1: initAudioContext is idempotent across repeated calls", async () => {
    const mod = await import("../feedback");
    mod.initAudioContext();
    mod.initAudioContext();
    mod.initAudioContext();
    const Ctor = globalThis.AudioContext as unknown as ReturnType<typeof vi.fn>;
    expect(Ctor).toHaveBeenCalledTimes(1);
  });

  it("Test 2: initAudioContext tolerates SSR-like env (no window) without throwing", async () => {
    // Undo per-test setup to simulate SSR — drop window.
    vi.resetModules();
    const originalWindow = globalThis.window;
    // @ts-expect-error intentionally removing window for SSR simulation
    delete globalThis.window;
    try {
      const mod = await import("../feedback");
      expect(() => mod.initAudioContext()).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it("Test 3: resumeAudioContext calls ctx.resume() when state is 'suspended'", async () => {
    vi.resetModules();
    const suspended = makeFakeAudioContext("suspended");
    const FakeAudioContext = vi.fn(function (this: unknown) {
      return suspended.ctx;
    });
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const mod = await import("../feedback");
    mod.initAudioContext();
    mod.resumeAudioContext();
    expect(suspended.resume).toHaveBeenCalledTimes(1);
  });

  it("Test 4: resumeAudioContext is a no-op when state is 'running'", async () => {
    const mod = await import("../feedback");
    mod.initAudioContext();
    mod.resumeAudioContext();
    expect(ctxHarness.resume).not.toHaveBeenCalled();
  });

  it("Test 5: playSuccessBeep sets oscillator.frequency.value to 880 and stops ~100 ms after start", async () => {
    const mod = await import("../feedback");
    mod.initAudioContext();
    mod.playSuccessBeep();

    const osc = ctxHarness.oscillators.at(-1);
    expect(osc, "an oscillator should have been created").toBeDefined();
    expect(osc!.frequency.value).toBe(880);
    expect(osc!.start).toHaveBeenCalledTimes(1);
    expect(osc!.stop).toHaveBeenCalledTimes(1);

    const startArg = osc!.start.mock.calls[0][0] as number;
    const stopArg = osc!.stop.mock.calls[0][0] as number;
    // Duration = 100 ms → 0.1 s
    expect(stopArg - startArg).toBeCloseTo(0.1, 5);
  });

  it("Test 6a: triggerHaptic calls navigator.vibrate when available", async () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    const mod = await import("../feedback");
    mod.triggerHaptic(50);
    expect(vibrate).toHaveBeenCalledWith(50);
  });

  it("Test 6b: triggerHaptic silently no-ops when navigator.vibrate is absent (D-17 iOS path)", async () => {
    // iOS Safari has no `navigator.vibrate`.
    vi.stubGlobal("navigator", {});
    const mod = await import("../feedback");
    expect(() => mod.triggerHaptic(50)).not.toThrow();
  });

  it("Test 7: triggerScanFeedback fires both playSuccessBeep AND triggerHaptic", async () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    const mod = await import("../feedback");
    mod.initAudioContext();
    mod.triggerScanFeedback();

    // playSuccessBeep creates an oscillator
    const osc = ctxHarness.oscillators.at(-1);
    expect(osc, "beep branch should have created an oscillator").toBeDefined();
    expect(osc!.frequency.value).toBe(880);
    // haptic branch called vibrate
    expect(vibrate).toHaveBeenCalledWith(50);
  });
});
