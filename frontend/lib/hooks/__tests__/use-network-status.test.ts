/**
 * Tests for useNetworkStatus hook
 *
 * Verifies:
 * - Initial online/offline state from navigator.onLine
 * - Online/offline event listener behavior
 * - wasOffline flag set on reconnect and cleared after 3s timeout
 * - Cleanup removes event listeners on unmount
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNetworkStatus } from "../use-network-status";

// Store original value for cleanup
const originalOnLine = navigator.onLine;

describe("useNetworkStatus", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");

    // Default: browser is online
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    addSpy.mockRestore();
    removeSpy.mockRestore();

    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  it("reports online when navigator.onLine is true", () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.wasOffline).toBe(false);
  });

  it("reports offline when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it("transitions to offline when offline event fires", () => {
    const { result } = renderHook(() => useNetworkStatus());

    const offlineHandler = addSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "offline"
    )?.[1] as EventListener;

    act(() => {
      offlineHandler(new Event("offline"));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it("transitions to online and sets wasOffline when online event fires after being offline", () => {
    const { result } = renderHook(() => useNetworkStatus());

    const offlineHandler = addSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "offline"
    )?.[1] as EventListener;
    const onlineHandler = addSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "online"
    )?.[1] as EventListener;

    // Go offline
    act(() => {
      offlineHandler(new Event("offline"));
    });
    expect(result.current.isOnline).toBe(false);

    // Come back online
    act(() => {
      onlineHandler(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(true);
  });

  it("clears wasOffline after 3 seconds", () => {
    const { result } = renderHook(() => useNetworkStatus());

    const offlineHandler = addSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "offline"
    )?.[1] as EventListener;
    const onlineHandler = addSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "online"
    )?.[1] as EventListener;

    // Go offline then online
    act(() => {
      offlineHandler(new Event("offline"));
    });
    act(() => {
      onlineHandler(new Event("online"));
    });
    expect(result.current.wasOffline).toBe(true);

    // Advance past the 3s timeout
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.wasOffline).toBe(false);
  });

  it("removes event listeners on unmount", () => {
    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();

    const removedOnline = removeSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "online"
    );
    const removedOffline = removeSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "offline"
    );

    expect(removedOnline).toBeDefined();
    expect(removedOffline).toBeDefined();
  });
});
