import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { loanHandlers } from "@/test/msw/loanHandlers";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { LoansListPage } from "./LoansListPage";

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

function renderPage(initialEntries: string[] = ["/loans"]) {
  setWsId("ws-1");
  // Register the Plan-01 loan handlers for this render (BARE { items } envelopes
  // + one active / one overdue / one returned fixture).
  server.use(...loanHandlers);
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
                <Route path="/loans" element={<LoansListPage />} />
                <Route path="/items/:id" element={<div>ITEM DETAIL</div>} />
                <Route path="/loans/new" element={<div>NEW LOAN</div>} />
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

describe("LoansListPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("default tab is Active — fetches /loans/active and shows item + borrower", async () => {
    renderPage();
    // The active fixture: Cordless Drill loaned to Alex.
    expect(await screen.findByText("Cordless Drill")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    // The overdue/returned fixtures are NOT in the active list.
    expect(screen.queryByText("Sam")).not.toBeInTheDocument();
    expect(screen.queryByText("Jordan")).not.toBeInTheDocument();
  });

  it("the Overdue tab fetches /loans/overdue and signals the row three ways", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Cordless Drill");

    await user.click(screen.getByRole("tab", { name: /overdue/i }));

    // Overdue fixture: borrower Sam.
    expect(await screen.findByText("Sam")).toBeInTheDocument();
    const row = screen.getByText("Sam").closest("tr")!;
    // Cue 1 — the danger Overdue pill word.
    expect(within(row).getByText(/overdue/i)).toBeInTheDocument();
    // Cue 2 — the ⚠ glyph in the due chip.
    expect(within(row).getByText(/⚠/)).toBeInTheDocument();
    // Cue 3 — the danger-bg row tint class.
    expect(row.className).toMatch(/bg-danger-bg/);
  });

  it("the History tab fetches GET /loans and shows only returned rows", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Cordless Drill");

    await user.click(screen.getByRole("tab", { name: /history/i }));

    // History filters the bare list to !is_active — only the returned fixture
    // (borrower Jordan) survives; the active (Alex) + overdue (Sam) drop out.
    expect(await screen.findByText("Jordan")).toBeInTheDocument();
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();
    expect(screen.queryByText("Sam")).not.toBeInTheDocument();
    // Each history row carries a Returned pill (the Due cell also says
    // "returned {date}", so match the pill's bare word exactly).
    const row = screen.getByText("Jordan").closest("tr")!;
    expect(within(row).getByText(/^returned$/i)).toBeInTheDocument();
  });

  it("EXPORT CSV with rows present triggers a download", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:loans");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    renderPage();
    await screen.findByText("Cordless Drill");

    await user.click(screen.getByRole("button", { name: /export csv/i }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it("EXPORT CSV is disabled on an empty tab", async () => {
    renderPage();
    await screen.findByText("Cordless Drill");

    // A search that matches nothing empties the visible rows.
    const search = screen.getByRole("searchbox");
    const user = userEvent.setup();
    await user.type(search, "zzz-no-match");

    await waitFor(() =>
      expect(screen.getByText(/no matches/i)).toBeInTheDocument(),
    );
    const exportBtn = screen.getByRole("button", { name: /export csv/i });
    expect(exportBtn).toBeDisabled();
  });
});
