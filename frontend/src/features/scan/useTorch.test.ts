// useTorch — capability probe + toggle (SCAN-04 / RESEARCH Pattern 4). Uses the
// Wave-0 getUserMedia stub (MockMediaDevices.torchSupported) + UA override.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { MockMediaDevices } from "@/test/setup";
import { useTorch } from "./useTorch";

const realUA = navigator.userAgent;

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    get: () => ua,
  });
}

beforeEach(() => {
  MockMediaDevices.reset();
  setUserAgent("Mozilla/5.0 (Linux; Android 14)"); // non-iOS default
});

afterEach(() => {
  MockMediaDevices.reset();
  setUserAgent(realUA);
  vi.restoreAllMocks();
});

describe("useTorch", () => {
  it("iOS UA → supported=false WITHOUT probing getUserMedia", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit",
    );
    const gum = vi.spyOn(navigator.mediaDevices, "getUserMedia");

    const { result } = renderHook(() => useTorch());

    // Give any async probe a tick — it must NOT run on iOS.
    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.supported).toBe(false);
    expect(gum).not.toHaveBeenCalled();
  });

  it("Android + torch:true → supported=true (probe then release the stream)", async () => {
    MockMediaDevices.torchSupported = true;
    const { result } = renderHook(() => useTorch());

    await waitFor(() => expect(result.current.supported).toBe(true));

    // The probe stream is released (every track stopped).
    expect(MockMediaDevices.streams.length).toBeGreaterThanOrEqual(1);
    for (const s of MockMediaDevices.streams) {
      for (const t of s.getTracks()) {
        expect(t.stopped).toBe(true);
      }
    }
  });

  it("Android + torch:false → supported=false", async () => {
    MockMediaDevices.torchSupported = false;
    const { result } = renderHook(() => useTorch());

    // Wait for the probe to settle, then assert unsupported.
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.supported).toBe(false);
  });

  it("toggle() flips the enabled boolean", async () => {
    MockMediaDevices.torchSupported = true;
    const { result } = renderHook(() => useTorch());
    await waitFor(() => expect(result.current.supported).toBe(true));

    expect(result.current.enabled).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
  });
});
