import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { WishlistPage } from "./WishlistPage";

// Phase 14 Plan 03 Task 3 — WishlistPage tests. useWorkspace mocked; MSW backs
// the status-filtered list + delete. Asserts the three tabs, the ?status re-query
// on tab switch, null-safe price rendering, the add-dialog open, the delete
// invalidate path, and the empty state.

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [{ id: "ws-1", name: "Alpha" }],
    isLoading: false,
  });
}

const WANTED = {
  id: "w-1",
  name: "Cordless Drill",
  priority: 3,
  status: "wanted" as const,
  price_estimate: 4999,
  currency_code: "EUR",
  created_at: "2026-06-13T00:00:00Z",
};
// A row with NO currency_code — must NOT white-screen through formatCents.
const WANTED_NULL_CCY = {
  id: "w-2",
  name: "Mystery Gadget",
  priority: 2,
  status: "wanted" as const,
  price_estimate: 1500,
  created_at: "2026-06-13T00:00:00Z",
};
const ORDERED = {
  id: "w-3",
  name: "Heat Gun",
  priority: 4,
  status: "ordered" as const,
  created_at: "2026-06-13T00:00:00Z",
};

/** Records every status the list endpoint was queried with. */
let statusCalls: (string | null)[] = [];

function installListHandler() {
  statusCalls = [];
  server.use(
    http.get("/api/workspaces/:ws/wishlist", ({ request }) => {
      const status = new URL(request.url).searchParams.get("status");
      statusCalls.push(status);
      if (status === "ordered")
        return HttpResponse.json({ items: [ORDERED], total: 1 });
      if (status === "acquired")
        return HttpResponse.json({ items: [], total: 0 });
      return HttpResponse.json({ items: [WANTED, WANTED_NULL_CCY], total: 2 });
    }),
  );
}

function renderPage(initialEntries: string[] = ["/wishlist"]) {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ShortcutsProvider>
          <ModalStackProvider>
            <RetroToaster />
            <MemoryRouter initialEntries={initialEntries}>
              <Routes>
                <Route path="/wishlist" element={<WishlistPage />} />
              </Routes>
            </MemoryRouter>
          </ModalStackProvider>
        </ShortcutsProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("WishlistPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders three tabs and the default WANTED tab queries ?status=wanted", async () => {
    installListHandler();
    renderPage();

    expect(screen.getByRole("tab", { name: /wanted/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /ordered/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /acquired/i })).toBeInTheDocument();

    expect(await screen.findByText("Cordless Drill")).toBeInTheDocument();
    expect(statusCalls).toContain("wanted");
  });

  it("renders a null-currency row without white-screening", async () => {
    installListHandler();
    renderPage();

    // The null-currency row renders its name + a price string (no crash).
    expect(await screen.findByText("Mystery Gadget")).toBeInTheDocument();
  });

  it("switching to ORDERED re-queries ?status=ordered", async () => {
    const user = userEvent.setup();
    installListHandler();
    renderPage();
    await screen.findByText("Cordless Drill");

    await user.click(screen.getByRole("tab", { name: /ordered/i }));

    expect(await screen.findByText("Heat Gun")).toBeInTheDocument();
    expect(statusCalls).toContain("ordered");
  });

  it("an empty tab renders a calm empty state", async () => {
    const user = userEvent.setup();
    installListHandler();
    renderPage();
    await screen.findByText("Cordless Drill");

    await user.click(screen.getByRole("tab", { name: /acquired/i }));

    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it("clicking Add opens the WishlistFormDialog", async () => {
    const user = userEvent.setup();
    installListHandler();
    renderPage();
    await screen.findByText("Cordless Drill");

    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/add to wishlist/i)).toBeInTheDocument();
  });

  it("deleting a row fires DELETE and refetches", async () => {
    const user = userEvent.setup();
    installListHandler();
    const delSpy = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.delete("/api/workspaces/:ws/wishlist/:id", delSpy));
    renderPage();
    await screen.findByText("Cordless Drill");

    const row = screen.getByText("Cordless Drill").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /delete/i }));

    // Confirm in the destructive dialog.
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /delete/i }));

    await waitFor(() => expect(delSpy).toHaveBeenCalled());
  });
});
