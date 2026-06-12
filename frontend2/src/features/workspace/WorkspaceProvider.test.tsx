import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { useWorkspace } from "./useWorkspace";

// Phase 05 Plan 03 — AUTH-06. WorkspaceProvider is the D-12 SSOT: it initialises
// currentWorkspaceId from the shared ["workspaces"] cache (first-workspace heal),
// persists the selection to localStorage["workspace_id"], and on switch
// invalidates entity caches (NOT window.location.reload — Pitfall 6).

const WS_PATH = "/api/users/me/workspaces";
const WS_KEY = "workspace_id";

const TWO_WORKSPACES = [
  {
    id: "ws-A",
    name: "Alpha",
    slug: "alpha",
    description: null,
    role: "owner",
    is_personal: true,
  },
  {
    id: "ws-B",
    name: "Beta",
    slug: "beta",
    description: null,
    role: "member",
    is_personal: false,
  },
];

// A tiny consumer that surfaces the context for assertions + a switch button.
function Probe() {
  const { currentWorkspaceId, setWorkspace, workspaces, isLoading } =
    useWorkspace();
  return (
    <div>
      <span data-testid="current">{currentWorkspaceId ?? "null"}</span>
      <span data-testid="count">{workspaces?.length ?? "undef"}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <button type="button" onClick={() => setWorkspace("ws-B")}>
        switch-to-B
      </button>
    </div>
  );
}

function renderProvider(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});

describe("WorkspaceProvider (D-12 SSOT)", () => {
  it("heals to the first workspace when localStorage is empty", async () => {
    server.use(http.get(WS_PATH, () => HttpResponse.json(TWO_WORKSPACES)));
    renderProvider(freshClient());

    await waitFor(() =>
      expect(screen.getByTestId("current")).toHaveTextContent("ws-A"),
    );
    expect(localStorage.getItem(WS_KEY)).toBe("ws-A");
  });

  it("honors a persisted localStorage value that is present in the list", async () => {
    localStorage.setItem(WS_KEY, "ws-B");
    server.use(http.get(WS_PATH, () => HttpResponse.json(TWO_WORKSPACES)));
    renderProvider(freshClient());

    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("2"),
    );
    expect(screen.getByTestId("current")).toHaveTextContent("ws-B");
    expect(localStorage.getItem(WS_KEY)).toBe("ws-B");
  });

  it("heals + rewrites localStorage when the persisted id is absent from the list", async () => {
    localStorage.setItem(WS_KEY, "ws-GONE");
    server.use(http.get(WS_PATH, () => HttpResponse.json(TWO_WORKSPACES)));
    renderProvider(freshClient());

    await waitFor(() =>
      expect(screen.getByTestId("current")).toHaveTextContent("ws-A"),
    );
    expect(localStorage.getItem(WS_KEY)).toBe("ws-A");
  });

  it("setWorkspace persists, updates context, and invalidates queries exactly once", async () => {
    server.use(http.get(WS_PATH, () => HttpResponse.json(TWO_WORKSPACES)));
    const client = freshClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    renderProvider(client);

    await waitFor(() =>
      expect(screen.getByTestId("current")).toHaveTextContent("ws-A"),
    );

    invalidateSpy.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "switch-to-B" }));

    expect(screen.getByTestId("current")).toHaveTextContent("ws-B");
    expect(localStorage.getItem(WS_KEY)).toBe("ws-B");
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it("currentWorkspaceId is null while ['workspaces'] is pending", async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    server.use(
      http.get(WS_PATH, async () => {
        await gate;
        return HttpResponse.json(TWO_WORKSPACES);
      }),
    );
    renderProvider(freshClient());

    // While the request hangs, no id is healed and isLoading is true.
    expect(screen.getByTestId("current")).toHaveTextContent("null");
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    resolve();
    await waitFor(() =>
      expect(screen.getByTestId("current")).toHaveTextContent("ws-A"),
    );
  });

  it("useWorkspace throws when used outside a WorkspaceProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <QueryClientProvider client={freshClient()}>
          <Probe />
        </QueryClientProvider>,
      ),
    ).toThrow(/useWorkspace must be used within a WorkspaceProvider/);
    spy.mockRestore();
  });
});
