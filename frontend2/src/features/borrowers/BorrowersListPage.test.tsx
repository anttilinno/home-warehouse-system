import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { borrowerHandlers } from "@/test/msw/borrowerHandlers";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { BorrowersListPage } from "./BorrowersListPage";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [
      {
        id: "ws-1",
        name: "Alpha",
        slug: "alpha",
        description: null,
        role: "owner",
        is_personal: true,
      },
    ],
    isLoading: false,
  });
}

function renderPage(initialEntries: string[] = ["/borrowers"]) {
  setWsId("ws-1");
  // Register the Plan-01 borrower handlers PER-RENDER (BARE { items } envelope,
  // three fixtures: Alex Carter / Sam Diaz / Jordan Lee).
  server.use(...borrowerHandlers);
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
                <Route path="/borrowers" element={<BorrowersListPage />} />
                <Route
                  path="/borrowers/new"
                  element={<div>NEW BORROWER PAGE</div>}
                />
                <Route
                  path="/borrowers/:id"
                  element={<div>BORROWER DETAIL</div>}
                />
                <Route
                  path="/borrowers/:id/edit"
                  element={<div>BORROWER EDIT</div>}
                />
              </Routes>
            </MemoryRouter>
          </ModalStackProvider>
        </ShortcutsProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

/** A page-2-worth of fixtures (30 borrowers) for the pager assertions. */
function makeManyHandler(count: number) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `bor-${i + 1}`,
    workspace_id: "ws-1",
    name: `Borrower ${String(i + 1).padStart(2, "0")}`,
    email: `b${i + 1}@example.io`,
    phone: undefined,
    notes: undefined,
    is_archived: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  }));
  return http.get("/api/workspaces/:wsId/borrowers", () =>
    HttpResponse.json({ items }),
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("BorrowersListPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders a row per borrower with name + contact (email then phone)", async () => {
    renderPage();
    expect(await screen.findByText("Alex Carter")).toBeInTheDocument();
    expect(screen.getByText("Sam Diaz")).toBeInTheDocument();
    expect(screen.getByText("Jordan Lee")).toBeInTheDocument();
    // Contact column: Alex has an email (preferred over phone).
    expect(screen.getByText("alex@example.io")).toBeInTheDocument();
  });

  it("client-filters by name substring WITHOUT firing a /borrowers/search request", async () => {
    const searchSpy = vi.fn();
    server.use(
      http.get("/api/workspaces/:wsId/borrowers/search", () => {
        searchSpy();
        return HttpResponse.json({ items: [] });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alex Carter");

    await user.type(screen.getByRole("searchbox"), "sam");

    await waitFor(() =>
      expect(screen.queryByText("Alex Carter")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Sam Diaz")).toBeInTheDocument();
    // The client search must NOT hit the /search endpoint.
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("paginates the client-computed pageCount (PER_PAGE=25) and page 2 shows the next slice", async () => {
    server.use(makeManyHandler(30));
    const user = userEvent.setup();
    renderPage();
    // Page 1 holds borrowers 01..25.
    expect(await screen.findByText("Borrower 01")).toBeInTheDocument();
    expect(screen.queryByText("Borrower 26")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    // Page 2 holds 26..30.
    expect(await screen.findByText("Borrower 26")).toBeInTheDocument();
    expect(screen.queryByText("Borrower 01")).not.toBeInTheDocument();
  });

  it("the NEW BORROWER CTA navigates to /borrowers/new", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alex Carter");

    await user.click(screen.getByRole("button", { name: /new borrower/i }));
    expect(await screen.findByText("NEW BORROWER PAGE")).toBeInTheDocument();
  });

  it("a row click navigates to /borrowers/:id; the EDIT action does NOT (stopPropagation)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alex Carter");

    // Clicking EDIT in the actions cell routes to /edit, NOT the detail row link.
    const row = screen.getByText("Alex Carter").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /edit/i }));
    expect(await screen.findByText("BORROWER EDIT")).toBeInTheDocument();
    expect(screen.queryByText("BORROWER DETAIL")).not.toBeInTheDocument();
  });

  it("a bare row click navigates to the borrower detail", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alex Carter");

    await user.click(screen.getByText("Alex Carter"));
    expect(await screen.findByText("BORROWER DETAIL")).toBeInTheDocument();
  });

  it("empty data renders the NO BORROWERS empty state with an ADD BORROWER action", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/borrowers", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/no borrowers/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add borrower/i }));
    expect(await screen.findByText("NEW BORROWER PAGE")).toBeInTheDocument();
  });

  it("a search with no matches renders NO MATCHES with CLEAR ALL", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alex Carter");

    await user.type(screen.getByRole("searchbox"), "zzz-no-match");
    await waitFor(() =>
      expect(screen.getByText(/no matches/i)).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(await screen.findByText("Alex Carter")).toBeInTheDocument();
  });
});
