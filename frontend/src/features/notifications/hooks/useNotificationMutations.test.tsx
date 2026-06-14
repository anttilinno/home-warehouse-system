import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { notificationHandlers } from "@/test/msw/notificationHandlers";
import { retroToast } from "@/components/retro";
import { useNotificationMutations } from "./useNotificationMutations";

vi.mock("@/components/retro", async (orig) => {
  const mod = await orig<typeof import("@/components/retro")>();
  return { ...mod, retroToast: { ...mod.retroToast, error: vi.fn() } };
});

function makeHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { client, wrapper };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useNotificationMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("markRead POSTs /notifications/{id}/read and invalidates the ['notifications'] prefix", async () => {
    const { client, wrapper } = makeHarness();
    server.use(...notificationHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useNotificationMutations(), { wrapper });
    await act(async () => {
      await result.current.markRead.mutateAsync("notif-1");
    });

    await waitFor(() =>
      expect(result.current.markRead.isSuccess).toBe(true),
    );
    // Prefix invalidate covers list + unread + unread/count.
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });

  it("markAllRead POSTs /notifications/read-all and invalidates the ['notifications'] prefix", async () => {
    const { client, wrapper } = makeHarness();
    server.use(...notificationHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useNotificationMutations(), { wrapper });
    await act(async () => {
      await result.current.markAllRead.mutateAsync();
    });

    await waitFor(() =>
      expect(result.current.markAllRead.isSuccess).toBe(true),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });

  it("the ['notifications'] prefix covers the ['notifications','unread','count'] key", async () => {
    const { client, wrapper } = makeHarness();
    server.use(...notificationHandlers);
    // Seed the badge cache, then assert the prefix invalidate marks it stale.
    client.setQueryData(["notifications", "unread", "count"], { count: 1 });

    const { result } = renderHook(() => useNotificationMutations(), { wrapper });
    await act(async () => {
      await result.current.markRead.mutateAsync("notif-1");
    });

    const state = client.getQueryState(["notifications", "unread", "count"]);
    expect(state?.isInvalidated).toBe(true);
  });

  it("on error retroToast.error fires and no unhandled rejection escapes", async () => {
    const { wrapper } = makeHarness();
    server.use(
      http.post("/api/notifications/:id/read", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useNotificationMutations(), { wrapper });
    await act(async () => {
      await result.current.markRead
        .mutateAsync("notif-1")
        .catch(() => undefined);
    });

    expect(result.current.markRead.isError).toBe(true);
    expect(retroToast.error).toHaveBeenCalledTimes(1);
  });
});
