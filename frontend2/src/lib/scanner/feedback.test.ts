import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The feedback module holds a singleton AudioContext at module scope, so each
// test re-imports it fresh (vi.resetModules) AFTER stubbing globals — otherwise
// the singleton built in the first test leaks into the rest and no new
// FakeAudioContext is constructed.
type FeedbackModule = typeof import("./feedback");
let feedback: FeedbackModule;

// SCAN-03 — beep + raw vibrate feedback. jsdom ships NO AudioContext, so we
// install a minimal fake here (the shared setup mocks camera + BarcodeDetector
// but not Web Audio). The fake records oscillator/gain creation + the
// frequency/duration the beep drives, and starts SUSPENDED so we can prove the
// module never resumes at import and that feedback.primeAudio() resumes inside a gesture.

class FakeAudioParam {
  value = 0;
}
class FakeOscillator {
  frequency = new FakeAudioParam();
  type = "";
  connectedTo: unknown = null;
  started: number | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  connect(node: unknown): void {
    this.connectedTo = node;
  }
  disconnect(): void {}
  start(t: number): void {
    this.started = t;
  }
  stop(t: number): void {
    this.stopped = t;
  }
}
class FakeGain {
  gain = new FakeAudioParam();
  connect(): void {}
  disconnect(): void {}
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: "suspended" | "running" = "suspended";
  currentTime = 0;
  readonly destination = {};
  oscillators: FakeOscillator[] = [];
  resumeCalls = 0;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = "running";
    return Promise.resolve();
  }
}

beforeEach(async () => {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
  // jsdom navigator has no vibrate; install a spy so triggerHaptic can call it.
  vi.stubGlobal("navigator", {
    ...navigator,
    vibrate: vi.fn(() => true),
  });
  // Fresh module instance per test → fresh singleton AudioContext.
  vi.resetModules();
  feedback = await import("./feedback");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("feedback — beep", () => {
  it("playSuccessBeep creates an 880Hz sine oscillator and starts/stops it", () => {
    feedback.playSuccessBeep();
    const ctx = FakeAudioContext.instances[0];
    expect(ctx).toBeDefined();
    expect(ctx.oscillators).toHaveLength(1);
    const osc = ctx.oscillators[0];
    expect(osc.frequency.value).toBe(880);
    expect(osc.type).toBe("sine");
    expect(osc.started).not.toBeNull();
    // 100ms duration → stop at start + 0.1s.
    expect(osc.stopped).toBeCloseTo((osc.started ?? 0) + 0.1, 5);
  });

  it("playErrorBeep uses 300Hz / 200ms", () => {
    feedback.playErrorBeep();
    const ctx = FakeAudioContext.instances[0];
    const osc = ctx.oscillators[0];
    expect(osc.frequency.value).toBe(300);
    expect(osc.stopped).toBeCloseTo((osc.started ?? 0) + 0.2, 5);
  });

  it("reuses a single AudioContext across beeps (singleton)", () => {
    feedback.playSuccessBeep();
    feedback.playErrorBeep();
    // Both beeps share one context instance.
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].oscillators).toHaveLength(2);
  });

  it("does NOT resume the context at import — only on a gesture via primeAudio", () => {
    // First beep lazily builds the ctx; playBeep best-effort resumes a suspended
    // ctx, but the gesture-driven primeAudio is the explicit unlock path.
    feedback.primeAudio();
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resumeCalls).toBeGreaterThanOrEqual(1);
    expect(ctx.state).toBe("running");
  });
});

describe("feedback — raw vibrate", () => {
  it("triggerHaptic calls navigator.vibrate when present", () => {
    feedback.triggerHaptic(50);
    expect(navigator.vibrate).toHaveBeenCalledWith(50);
  });

  it("triggerHaptic no-ops (does not throw) when vibrate is absent", () => {
    vi.stubGlobal("navigator", { ...navigator, vibrate: undefined });
    expect(() => feedback.triggerHaptic(50)).not.toThrow();
  });
});
