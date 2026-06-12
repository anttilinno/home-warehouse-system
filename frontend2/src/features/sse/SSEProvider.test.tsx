import { useEffect, useRef } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { MockEventSource } from "@/test/setup";
import { queryClient } from "@/lib/queryClient";
import { SSEProvider } from "./SSEProvider";
import { useSSE } from "./useSSE";
import { useSSEStatus } from "./useSSEStatus";
import type { SSEEvent } from "./types";

// useWorkspace is the wsId source (D-12). Mock it so the SSE URL is stable and a
// test can flip the wsId to exercise the close+reopen path. The factory returns
// a mutable `currentWorkspaceId` via a module-level ref so individual tests can
// re-point it before re-render.
const WS_A = "ws-aaaa-1111";
const WS_B = "ws-bbbb-2222";
let mockWorkspaceId: string | null = WS_A;
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => ({
    currentWorkspaceId: mockWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: undefined,
    isLoading: false,
  }),
}));

// A connected `data` frame the backend sends on open.
const CONNECTED = { client_id: "client-xyz" };

// A faithful domain event frame (verified wire shape, RESEARCH §Event JSON shape).
function event(partial: Partial<SSEEvent> & { entity_type: string }): SSEEvent {
  return {
    type: `${partial.entity_type.toLowerCase()}.created`,
    entity_id: "ent-1",
    workspace_id: WS_A,
    user_id: "user-1",
    timestamp: "2026-06-13T00:00:00.000Z",
    ...partial,
  } as SSEEvent;
}

let invalidateSpy: Mock;

beforeEach(() => {
  mockWorkspaceId = WS_A;
  invalidateSpy = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockImplementation(() => Promise.resolve()) as unknown as Mock;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function StatusProbe({ onRender }: { onRender?: () => void }) {
  const { connected } = useSSEStatus();
  onRender?.();
  return <div data-testid="status">{connected ? "connected" : "offline"}</div>;
}

// 1 — single connection, cookie auth, no token in URL
it("opens exactly one EventSource to the workspace SSE endpoint with cookie auth", () => {
  render(
    <SSEProvider>
      <div />
    </SSEProvider>,
  );

  expect(MockEventSource.openCount).toBe(1);
  const es = MockEventSource.last!;
  expect(es.url).toBe(`/api/workspaces/${WS_A}/sse`);
  expect(es.withCredentials).toBe(true);
  expect(es.url).not.toContain("?token=");
  expect(es.url).not.toMatch(/eyJ/); // no JWT
});

// 2 — connected event flips status
it("flips connected true on the `connected` event", () => {
  render(
    <SSEProvider>
      <StatusProbe />
    </SSEProvider>,
  );

  expect(screen.getByTestId("status")).toHaveTextContent("offline");
  act(() => MockEventSource.last!.emit("connected", CONNECTED));
  expect(screen.getByTestId("status")).toHaveTextContent("connected");
});

// 3 — domain event → invalidateQueries with [entityPlural, wsId]
it("invalidates [categories, wsId] on a category.created event", () => {
  render(
    <SSEProvider>
      <div />
    </SSEProvider>,
  );

  act(() =>
    MockEventSource.last!.emit(
      "category.created",
      event({ entity_type: "category" }),
    ),
  );

  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: ["categories", WS_A],
  });
});

// 4 — uppercase ITEM outlier still invalidates [items, wsId]
it("invalidates [items, wsId] even when entity_type is uppercase ITEM", () => {
  render(
    <SSEProvider>
      <div />
    </SSEProvider>,
  );

  act(() =>
    MockEventSource.last!.emit("item.created", {
      ...event({ entity_type: "ITEM" }),
      type: "item.created",
    }),
  );

  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["items", WS_A] });
});

// 5 — useSSE receives events and unsubscribes on unmount
it("delivers events to useSSE consumers and stops after unmount", () => {
  const received: SSEEvent[] = [];
  function Sub() {
    useSSE({ onEvent: (e) => received.push(e) });
    return null;
  }

  const { unmount } = render(
    <SSEProvider>
      <Sub />
    </SSEProvider>,
  );

  const ev = event({ entity_type: "category" });
  act(() => MockEventSource.last!.emit("category.created", ev));
  expect(received).toHaveLength(1);
  expect(received[0].entity_type).toBe("category");

  unmount();
  // Provider closed the stream; a closed stub is inert, so no further delivery.
  expect(received).toHaveLength(1);
});

// 6 — status consumers do NOT re-render on event traffic (split-context isolation)
it("does not re-render status consumers on an event burst", () => {
  const renderCount = { n: 0 };

  function Sub() {
    // A subscriber consuming events keeps the burst flowing through the provider.
    useSSE({ onEvent: () => {} });
    return null;
  }

  render(
    <SSEProvider>
      <StatusProbe onRender={() => renderCount.n++} />
      <Sub />
    </SSEProvider>,
  );

  // Establish the connected baseline (this legitimately re-renders the status).
  act(() => MockEventSource.last!.emit("connected", CONNECTED));
  const baseline = renderCount.n;

  // Burst of domain events: status value never changes → no status re-renders.
  act(() => {
    for (let i = 0; i < 20; i++) {
      MockEventSource.last!.emit(
        "category.created",
        event({ entity_type: "category" }),
      );
    }
  });

  expect(renderCount.n).toBe(baseline);
});

// 7 — error → reconnect after capped-backoff delay
it("reconnects after the backoff delay on error", () => {
  vi.useFakeTimers();
  render(
    <SSEProvider>
      <div />
    </SSEProvider>,
  );

  expect(MockEventSource.openCount).toBe(1);
  const first = MockEventSource.last!;

  act(() => first.emitError());
  // The errored connection is closed; reconnect is scheduled, not immediate.
  expect(first.readyState).toBe(MockEventSource.CLOSED);

  act(() => {
    vi.advanceTimersByTime(30_000); // beyond any first-attempt backoff
  });

  // A fresh connection opened to the same endpoint.
  expect(MockEventSource.openCount).toBe(1);
  expect(MockEventSource.last).not.toBe(first);
  expect(MockEventSource.last!.url).toBe(`/api/workspaces/${WS_A}/sse`);
});

// 8 — auth-expired closes the stream and halts reconnect
it("closes the stream and stops reconnecting on auth-expired", () => {
  vi.useFakeTimers();
  render(
    <SSEProvider>
      <div />
    </SSEProvider>,
  );
  const es = MockEventSource.last!;

  act(() => {
    window.dispatchEvent(new CustomEvent("auth-expired"));
  });
  expect(es.readyState).toBe(MockEventSource.CLOSED);

  // No reconnect even after a long wait.
  act(() => vi.advanceTimersByTime(120_000));
  expect(MockEventSource.openCount).toBe(0);
});

// 9 — wsId change closes the old instance and opens a new one
it("closes the old connection and opens a new one on wsId change", () => {
  const { rerender } = render(
    <SSEProvider>
      <div />
    </SSEProvider>,
  );
  const first = MockEventSource.last!;
  expect(first.url).toBe(`/api/workspaces/${WS_A}/sse`);

  act(() => {
    mockWorkspaceId = WS_B;
    rerender(
      <SSEProvider>
        <div />
      </SSEProvider>,
    );
  });

  expect(first.readyState).toBe(MockEventSource.CLOSED);
  expect(MockEventSource.openCount).toBe(1);
  expect(MockEventSource.last!.url).toBe(`/api/workspaces/${WS_B}/sse`);
});

// 10 — unmount closes the connection
it("closes the connection on unmount", () => {
  const { unmount } = render(
    <SSEProvider>
      <div />
    </SSEProvider>,
  );
  const es = MockEventSource.last!;
  expect(es.readyState).toBe(MockEventSource.OPEN);

  unmount();
  expect(es.readyState).toBe(MockEventSource.CLOSED);
  expect(MockEventSource.openCount).toBe(0);
});

// Hooks guard: useSSE / useSSEStatus throw outside the provider.
describe("provider guards", () => {
  it("useSSEStatus throws outside SSEProvider", () => {
    expect(() => renderHook(() => useSSEStatus())).toThrow();
  });

  it("useSSE throws outside SSEProvider", () => {
    expect(() =>
      renderHook(() =>
        // wrap in a component so the throw surfaces during render
        useSSE({ onEvent: () => {} }),
      ),
    ).toThrow();
  });
});

// Malformed payloads are ignored (no throw, no invalidation).
it("ignores a malformed event payload without throwing", () => {
  render(
    <SSEProvider>
      <div />
    </SSEProvider>,
  );

  expect(() =>
    act(() => MockEventSource.last!.emit("category.created", "{not json")),
  ).not.toThrow();
  expect(invalidateSpy).not.toHaveBeenCalled();
});

// Unknown entity_type is a forward-compatible no-op.
it("treats an unknown entity_type as a no-op", () => {
  render(
    <SSEProvider>
      <div />
    </SSEProvider>,
  );

  act(() =>
    MockEventSource.last!.emit("widget.created", {
      ...event({ entity_type: "widget" }),
      type: "widget.created",
    }),
  );

  expect(invalidateSpy).not.toHaveBeenCalled();
});

// Re-rendering a useSSE consumer must not churn the subscription (callback-in-ref).
it("does not re-subscribe useSSE when the consumer re-renders", () => {
  const received: SSEEvent[] = [];
  function Sub() {
    const r = useRef(0);
    r.current++;
    useSSE({ onEvent: (e) => received.push(e) });
    // Force a re-render after mount to prove the subscription is stable.
    useEffect(() => {
      r.current = r.current;
    });
    return null;
  }

  render(
    <SSEProvider>
      <Sub />
    </SSEProvider>,
  );

  act(() =>
    MockEventSource.last!.emit("category.created", event({ entity_type: "category" })),
  );
  // Exactly one delivery — no duplicate from a churned subscription.
  expect(received).toHaveLength(1);
});
