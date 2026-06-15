import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { RequireAuth } from "./RequireAuth";

// Phase 05 Plan 02 — AUTH-05. Exercises both guard branches against the shared
// MSW server: 401/403 redirect vs network/5xx retry-not-logout, plus the
// auth-expired event consumer (the single Task 2 listener) with cleanup.

const WS_PATH = "/api/users/me/workspaces";

function renderGuard() {
  // A fresh client per render so query cache never leaks between cases; retry
  // off mirrors the guard's own retry:false probe.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="/"
              element={
                <RequireAuth>
                  <div>protected content</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div>login sentinel</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
});

describe("RequireAuth", () => {
  it("renders children when the workspaces probe succeeds", async () => {
    server.use(http.get(WS_PATH, () => HttpResponse.json([{ id: "ws-1" }])));
    renderGuard();
    expect(await screen.findByText("protected content")).toBeInTheDocument();
  });

  it("redirects to /login on 401", async () => {
    server.use(
      http.get(WS_PATH, () => new HttpResponse(null, { status: 401 })),
    );
    renderGuard();
    expect(await screen.findByText("login sentinel")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("redirects to /login on 403 (never reaches retry surface)", async () => {
    server.use(
      http.get(WS_PATH, () => new HttpResponse(null, { status: 403 })),
    );
    renderGuard();
    expect(await screen.findByText("login sentinel")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a retry surface and does NOT log out on 5xx (v2.0 regression guard)", async () => {
    server.use(
      http.get(WS_PATH, () => new HttpResponse(null, { status: 500 })),
    );
    renderGuard();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Couldn't reach the server. Check your connection and retry.",
    );
    // The spurious-logout regression: 5xx must NOT navigate to /login.
    expect(screen.queryByText("login sentinel")).not.toBeInTheDocument();

    // Retry refetches: flip the handler to 200 then click Retry → children.
    server.use(http.get(WS_PATH, () => HttpResponse.json([{ id: "ws-1" }])));
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("protected content")).toBeInTheDocument();
  });

  it("shows a retry surface (not logout) on a network error", async () => {
    server.use(http.get(WS_PATH, () => HttpResponse.error()));
    renderGuard();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("login sentinel")).not.toBeInTheDocument();
  });

  it("navigates to /login when an auth-expired event fires, and removes the listener on unmount", async () => {
    server.use(http.get(WS_PATH, () => HttpResponse.json([{ id: "ws-1" }])));
    const { unmount } = renderGuard();
    expect(await screen.findByText("protected content")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent("auth-expired"));
    });
    await waitFor(() =>
      expect(screen.getByText("login sentinel")).toBeInTheDocument(),
    );

    // Cleanup proof: after unmount a re-dispatch must not throw or navigate.
    unmount();
    expect(() =>
      act(() => {
        window.dispatchEvent(new CustomEvent("auth-expired"));
      }),
    ).not.toThrow();
  });
});
