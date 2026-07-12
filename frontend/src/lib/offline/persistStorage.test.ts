import { afterEach, describe, expect, it, vi } from "vitest";
import { requestPersistentStorage } from "./persistStorage";

describe("requestPersistentStorage", () => {
  afterEach(() => {
    // jsdom ships no navigator.storage by default; drop whatever a test defined.
    Reflect.deleteProperty(navigator, "storage");
    vi.restoreAllMocks();
  });

  it("resolves without throwing when navigator.storage is unsupported (jsdom default)", async () => {
    expect((navigator as { storage?: unknown }).storage).toBeUndefined();
    await expect(requestPersistentStorage()).resolves.toBeUndefined();
  });

  it("logs the grant result when persist() resolves true", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persist: vi.fn().mockResolvedValue(true) },
    });

    await requestPersistentStorage();

    expect(debugSpy).toHaveBeenCalledWith("[offline] persistent storage: true");
  });

  it("logs the grant result when persist() resolves false", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persist: vi.fn().mockResolvedValue(false) },
    });

    await requestPersistentStorage();

    expect(debugSpy).toHaveBeenCalledWith(
      "[offline] persistent storage: false",
    );
  });

  it("swallows a rejected persist() probe without throwing or logging", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persist: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await expect(requestPersistentStorage()).resolves.toBeUndefined();
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
