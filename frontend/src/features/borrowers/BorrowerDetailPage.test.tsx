import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { BorrowerDetailPage } from "./BorrowerDetailPage";

const WS = "ws-1";
const ID = "bor-1";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [{ id: WS, name: "Home" }],
    isLoading: false,
  });
}

let lastPath = "";
function Probe() {
  const loc = useLocation();
  lastPath = loc.pathname;
  return null;
}

function makeBorrower(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    workspace_id: WS,
    name: "Alex Carter",
    email: "alex@example.io",
    phone: "+1 555 0100",
    notes: "lives next door",
    is_archived: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function activeLoan(id: string) {
  return {
    id,
    workspace_id: WS,
    inventory_id: "inv-1",
    borrower_id: ID,
    quantity: 1,
    loaned_at: "2026-06-01T00:00:00Z",
    due_date: "2026-07-01T00:00:00Z",
    is_active: true,
    is_overdue: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    item: { id: "it-1", name: "Cordless Drill" },
    borrower: { id: ID, name: "Alex Carter" },
  };
}

interface Fixtures {
  borrower?: Record<string, unknown>;
  borrowerStatus?: number;
  loans?: ReturnType<typeof activeLoan>[];
  onDelete?: () => void;
  deleteStatus?: number;
}

function installHandlers(f: Fixtures) {
  server.use(
    http.get("/api/workspaces/:wsId/borrowers/:id/loans", () =>
      HttpResponse.json({ items: f.loans ?? [] }),
    ),
    http.get("/api/workspaces/:wsId/borrowers/:id", () => {
      if (f.borrowerStatus && f.borrowerStatus !== 200) {
        return new HttpResponse(null, { status: f.borrowerStatus });
      }
      return HttpResponse.json(f.borrower ?? makeBorrower());
    }),
    http.delete("/api/workspaces/:wsId/borrowers/:id", () => {
      f.onDelete?.();
      if (f.deleteStatus && f.deleteStatus !== 204) {
        return HttpResponse.json(
          { detail: "cannot delete borrower with active loans" },
          { status: f.deleteStatus },
        );
      }
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

function renderDetail(initialPath = `/borrowers/${ID}`) {
  setWsId(WS);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter initialEntries={[initialPath]}>
            <Probe />
            <Routes>
              <Route path="/borrowers/:id" element={<BorrowerDetailPage />} />
              <Route path="/borrowers" element={<div>BORROWERS LIST</div>} />
              <Route
                path="/borrowers/:id/edit"
                element={<div>EDIT PAGE</div>}
              />
              <Route path="/loans" element={<div>LOANS LIST</div>} />
            </Routes>
          </MemoryRouter>
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("BorrowerDetailPage", () => {
  it("renders the profile and mounts the Active + History loan panels", async () => {
    installHandlers({ borrower: makeBorrower(), loans: [] });
    renderDetail();

    // Titlebar + profile fields.
    expect(await screen.findAllByText(/alex carter/i)).not.toHaveLength(0);
    expect(screen.getByText("alex@example.io")).toBeInTheDocument();
    expect(screen.getByText("+1 555 0100")).toBeInTheDocument();
    // The mounted BorrowerLoanPanels Windows.
    expect(screen.getAllByText(/active loans/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/loan history/i).length).toBeGreaterThan(0);
  });

  it("renders muted — for missing optional fields", async () => {
    installHandlers({
      borrower: makeBorrower({ email: undefined, phone: undefined, notes: undefined }),
      loans: [],
    });
    renderDetail();
    await screen.findAllByText(/alex carter/i);
    // Email / phone / notes all show the muted dash.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("active loans > 0 disables DELETE and shows the badge + banner + link", async () => {
    installHandlers({ borrower: makeBorrower(), loans: [activeLoan("l-1")] });
    renderDetail();
    await screen.findAllByText(/alex carter/i);

    // DELETE is disabled.
    const del = await screen.findByRole("button", { name: /delete…/i });
    await waitFor(() => expect(del).toBeDisabled());
    // Red badge beside it.
    expect(screen.getByText(/⚠ active loans/i)).toBeInTheDocument();
    // Inline danger banner + the "View active loans" link.
    expect(
      screen.getByText(/return the active loans before deleting/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view active loans/i }),
    ).toHaveAttribute("href", "/loans?tab=active");
  });

  it("active loans = 0 → confirm deletes and navigates to /borrowers", async () => {
    const user = userEvent.setup();
    let deleted = false;
    installHandlers({
      borrower: makeBorrower(),
      loans: [],
      onDelete: () => (deleted = true),
    });
    renderDetail();
    await screen.findAllByText(/alex carter/i);

    const del = await screen.findByRole("button", { name: /delete…/i });
    await waitFor(() => expect(del).not.toBeDisabled());
    await user.click(del);

    const dialog = await screen.findByRole("dialog", {
      name: /delete borrower/i,
    });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(deleted).toBe(true));
    expect(await screen.findByText("BORROWERS LIST")).toBeInTheDocument();
    expect(lastPath).toBe("/borrowers");
  });

  it("a 400 on delete surfaces the active-loans backstop toast and does NOT navigate", async () => {
    const user = userEvent.setup();
    // No active loans in the panel state (a race) → DELETE is enabled, but the
    // API rejects with 400.
    installHandlers({ borrower: makeBorrower(), loans: [], deleteStatus: 400 });
    renderDetail();
    await screen.findAllByText(/alex carter/i);

    const del = await screen.findByRole("button", { name: /delete…/i });
    await waitFor(() => expect(del).not.toBeDisabled());
    await user.click(del);
    const dialog = await screen.findByRole("dialog", {
      name: /delete borrower/i,
    });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    // The 09-01 hook backstop maps the 400 to the active-loans toast.
    expect(
      await screen.findByText(/has active loans/i),
    ).toBeInTheDocument();
    // Did NOT navigate away.
    expect(lastPath).toBe(`/borrowers/${ID}`);
  });

  it("shows BORROWER NOT FOUND when the borrower 404s", async () => {
    const user = userEvent.setup();
    installHandlers({ borrowerStatus: 404 });
    renderDetail();
    expect(
      await screen.findByText(/borrower not found/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back to borrowers/i }));
    expect(await screen.findByText("BORROWERS LIST")).toBeInTheDocument();
  });

  it("EDIT navigates to the edit route", async () => {
    const user = userEvent.setup();
    installHandlers({ borrower: makeBorrower(), loans: [] });
    renderDetail();
    await screen.findAllByText(/alex carter/i);
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(await screen.findByText("EDIT PAGE")).toBeInTheDocument();
  });
});
