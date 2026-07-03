import { describe, expect, it, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  useMutation,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePendingWrites } from "./usePendingWrites";

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("usePendingWrites", () => {
  afterEach(() => {
    onlineManager.setOnline(true); // restore the default for later tests
  });

  it("counts a paused (offline-queued) mutation, and drops back to 0 once it drains", async () => {
    const client = new QueryClient();
    const { result: pending } = renderHook(() => usePendingWrites(), {
      wrapper: wrapper(client),
    });
    expect(pending.current).toBe(0);

    onlineManager.setOnline(false);
    const { result: mutation } = renderHook(
      () =>
        useMutation({
          mutationKey: ["test", "write"],
          mutationFn: async () => "ok",
        }),
      { wrapper: wrapper(client) },
    );
    mutation.current.mutate();

    // Offline: networkMode:"online" pauses it — status "pending", isPaused true.
    await waitFor(() => expect(pending.current).toBe(1));

    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await waitFor(() => expect(pending.current).toBe(0));
  });
});
