import { afterEach, describe, expect, it, vi } from "vitest";
import { onlineManager } from "@tanstack/react-query";

// App.tsx:56-66 seeds onlineManager from navigator.onLine at module import —
// guards the documented offline-reload-drains-queue bug (a cold/reload boot
// while offline must NOT report online, or PersistQueryClientProvider's
// onSuccess → resumePausedMutations drains the restored write queue against a
// dead network and loses it). vi.resetModules + a fresh dynamic import forces
// App.tsx's module-scope seed to run again under the stubbed navigator.

afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true); // restore the default for later tests
});

describe("App.tsx onlineManager boot seed", () => {
  it("seeds onlineManager to false when navigator.onLine is false at import", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    vi.resetModules();

    await import("./App");

    expect(onlineManager.isOnline()).toBe(false);
  });

  it("seeds onlineManager to true when navigator.onLine is true at import", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    vi.resetModules();

    await import("./App");

    expect(onlineManager.isOnline()).toBe(true);
  });
});
