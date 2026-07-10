import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { notificationHandlers, NOTIF_UNREAD } from "@/test/msw/notificationHandlers";
import { useNotificationsQuery, useUnreadCountQuery } from "./useNotifications";

// Phase 4 Plan Test-Gaps 4.3 — read-hook coverage for the two query keys the
// notification bell + list page depend on. Keys are USER-scoped (no wsId), per
// the hook's block comment; unread/count polls but the poll interval itself is
// not asserted here (that's an integration/e2e concern).

function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useNotificationsQuery", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("fetches the list keyed ['notifications','list',{page,limit}]", async () => {
    server.use(...notificationHandlers);
    const client = freshClient();

    const { result } = renderHook(() => useNotificationsQuery(), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.total).toBe(2);
    expect(
      client.getQueryState(["notifications", "list", { page: 1, limit: 50 }]),
    ).toBeDefined();
  });

  it("clamps a limit above 100 down to 100", async () => {
    let seenLimit: string | null = null;
    server.use(
      http.get("/api/notifications", ({ request }) => {
        seenLimit = new URL(request.url).searchParams.get("limit");
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          total_pages: 0,
        });
      }),
    );

    const { result } = renderHook(() => useNotificationsQuery({ limit: 500 }), {
      wrapper: wrapperWith(freshClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(seenLimit).toBe("100");
  });

  it("degrades to empty items/total=0 on error (retry:false)", async () => {
    server.use(
      http.get("/api/notifications", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useNotificationsQuery(), {
      wrapper: wrapperWith(freshClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});

describe("useUnreadCountQuery", () => {
  it("fetches the badge count keyed ['notifications','unread','count']", async () => {
    server.use(...notificationHandlers);
    const client = freshClient();

    const { result } = renderHook(() => useUnreadCountQuery(), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.count).toBe(1));
    expect(
      client.getQueryState(["notifications", "unread", "count"]),
    ).toBeDefined();
  });

  it("degrades to count=0 on error (retry:false)", async () => {
    server.use(
      http.get("/api/notifications/unread/count", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useUnreadCountQuery(), {
      wrapper: wrapperWith(freshClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.count).toBe(0);
  });

  it("returns the unread item seeded via notificationHandlers unaffected by list state", async () => {
    server.use(...notificationHandlers);
    const { result } = renderHook(() => useNotificationsQuery(), {
      wrapper: wrapperWith(freshClient()),
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items[0]).toMatchObject({ id: NOTIF_UNREAD.id });
  });
});
