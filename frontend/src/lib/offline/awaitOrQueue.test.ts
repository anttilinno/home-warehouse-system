import { afterEach, describe, expect, it, vi } from "vitest";
import { onlineManager } from "@tanstack/react-query";
import { retroToast } from "@/components/retro";
import { awaitOrQueue } from "./awaitOrQueue";

// The contract the four form-create wrappers depend on: offline a create is
// FIRED (queued) and the promise resolves `null` so the form can navigate away;
// online nothing changes, including how a failure reaches the caller's catch.

function fakeMutation<T>(settle: () => Promise<T>) {
  return { mutate: vi.fn(), mutateAsync: vi.fn(settle) };
}

afterEach(() => {
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

describe("awaitOrQueue", () => {
  it("online: awaits mutateAsync and returns the server row", async () => {
    onlineManager.setOnline(true);
    const m = fakeMutation(async () => ({ id: "item-1" }));

    await expect(awaitOrQueue(m, { sku: "A" })).resolves.toEqual({
      id: "item-1",
    });
    expect(m.mutateAsync).toHaveBeenCalledWith({ sku: "A" });
    expect(m.mutate).not.toHaveBeenCalled();
  });

  it("online: a rejection still propagates (the form banner depends on it)", async () => {
    onlineManager.setOnline(true);
    const m = fakeMutation(async () => {
      throw new Error("422");
    });

    await expect(awaitOrQueue(m, { sku: "A" })).rejects.toThrow("422");
  });

  it("offline: fires the mutation, resolves null, and says it was queued", async () => {
    const info = vi.spyOn(retroToast, "info").mockReturnValue("toast-1");
    onlineManager.setOnline(false);
    const m = fakeMutation(async () => ({ id: "never" }));

    await expect(awaitOrQueue(m, { sku: "A" })).resolves.toBeNull();
    expect(m.mutate).toHaveBeenCalledWith({ sku: "A" });
    // The whole point: mutateAsync is what hangs offline, so it must not run.
    expect(m.mutateAsync).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
  });
});
