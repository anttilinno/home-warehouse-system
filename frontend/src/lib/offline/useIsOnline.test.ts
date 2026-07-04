import { describe, expect, it, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { useIsOnline } from "./useIsOnline";

describe("useIsOnline", () => {
  afterEach(() => {
    onlineManager.setOnline(true); // restore the default for later tests
  });

  it("reflects the current onlineManager state and updates on change", () => {
    onlineManager.setOnline(true);
    const { result } = renderHook(() => useIsOnline());
    expect(result.current).toBe(true);

    act(() => onlineManager.setOnline(false));
    expect(result.current).toBe(false);

    act(() => onlineManager.setOnline(true));
    expect(result.current).toBe(true);
  });
});
