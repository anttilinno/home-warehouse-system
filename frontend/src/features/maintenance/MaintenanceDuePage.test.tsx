import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { ModalStackProvider } from "@/components/modal";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { maintenanceHandlers } from "@/test/msw/maintenanceHandlers";
import { MaintenanceDuePage } from "./MaintenanceDuePage";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [{ id: "ws-1", name: "Garage" }],
    isLoading: false,
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>{children}</ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
  return render(<MaintenanceDuePage />, { wrapper });
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("MaintenanceDuePage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
    setWsId("ws-1");
  });

  it("renders a RetroTable with Item / Schedule / Next due / Status columns", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderPage();
    expect(await screen.findByText("Air Compressor")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Item" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Schedule" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Next due" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Status" }),
    ).toBeInTheDocument();
  });

  it("an is_overdue:true row carries ALL THREE cues (tint + Overdue pill + ⚠ chip)", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderPage();
    // DUE_OVERDUE — item Air Compressor, is_overdue:true.
    const row = (await screen.findByText("Air Compressor")).closest("tr")!;
    // Cue 1: row tint.
    expect(row.className).toContain("bg-danger-bg");
    // Cue 2: danger Overdue pill word.
    expect(within(row).getByText("Overdue")).toBeInTheDocument();
    // Cue 3: ⚠-prefixed next-due chip.
    expect(within(row).getByText(/⚠/)).toBeInTheDocument();
  });

  it("an is_overdue:false row renders a neutral next_due + ok Due pill (no ⚠, no tint)", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderPage();
    // DUE_UPCOMING — item Lawn Mower, is_overdue:false.
    const row = (await screen.findByText("Lawn Mower")).closest("tr")!;
    expect(row.className).not.toContain("bg-danger-bg");
    expect(within(row).getByText("Due")).toBeInTheDocument();
    expect(within(row).queryByText(/⚠/)).not.toBeInTheDocument();
  });

  it("the cue follows the SERVER flag, NOT the date (flip is_overdue only)", async () => {
    setWsId("ws-1");
    // Same next_due date on BOTH rows; ONLY is_overdue differs. The overdue cue
    // must track the flag — proving zero client date math (override #3).
    server.use(
      http.get("/api/workspaces/:wsId/maintenance/due", () =>
        HttpResponse.json({
          items: [
            {
              id: "flagged",
              title: "Flagged task",
              interval_days: 30,
              next_due: "2026-09-09",
              item_id: "i-1",
              item_name: "Flagged Item",
              is_overdue: true,
            },
            {
              id: "unflagged",
              title: "Unflagged task",
              interval_days: 30,
              next_due: "2026-09-09",
              item_id: "i-2",
              item_name: "Unflagged Item",
              is_overdue: false,
            },
          ],
        }),
      ),
    );
    renderPage();
    const flaggedRow = (await screen.findByText("Flagged Item")).closest("tr")!;
    const unflaggedRow = (await screen.findByText("Unflagged Item")).closest(
      "tr",
    )!;
    // Identical dates, divergent cues — only the flag drives the treatment.
    expect(within(flaggedRow).getByText("Overdue")).toBeInTheDocument();
    expect(within(flaggedRow).getByText(/⚠/)).toBeInTheDocument();
    expect(within(unflaggedRow).getByText("Due")).toBeInTheDocument();
    expect(within(unflaggedRow).queryByText(/⚠/)).not.toBeInTheDocument();
  });

  it("clicking COMPLETE opens the confirm and calls the complete endpoint", async () => {
    setWsId("ws-1");
    let completed = false;
    server.use(
      http.post("/api/workspaces/:wsId/maintenance/:id/complete", () => {
        completed = true;
        return HttpResponse.json({
          id: "sched-b",
          title: "Filter replacement",
          interval_days: 90,
          next_due: "2026-09-08",
        });
      }),
      ...maintenanceHandlers,
    );
    renderPage();
    const row = (await screen.findByText("Air Compressor")).closest("tr")!;
    await userEvent.click(within(row).getByText("COMPLETE"));
    expect(
      await screen.findByText("COMPLETE MAINTENANCE?"),
    ).toBeInTheDocument();
    // Confirm inside the dialog (the row button shares the COMPLETE label).
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "COMPLETE" }),
    );
    await waitFor(() => expect(completed).toBe(true));
  });

  it("renders the NOTHING DUE empty state for an empty fixture", async () => {
    setWsId("ws-1");
    server.use(
      http.get("/api/workspaces/:wsId/maintenance/due", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderPage();
    expect(await screen.findByText("NOTHING DUE")).toBeInTheDocument();
  });
});
