import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { ModalStackProvider } from "@/components/modal";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { maintenanceHandlers } from "@/test/msw/maintenanceHandlers";
import { MaintenanceDrawer } from "./MaintenanceDrawer";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  });
}

function renderDrawer(invId: string | null = "inv-1") {
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
  return render(
    <MaintenanceDrawer
      invId={invId}
      itemName="Cordless Drill"
      onClose={vi.fn()}
    />,
    { wrapper },
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("MaintenanceDrawer", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
    setWsId("ws-1");
  });

  it("is closed when invId is null", () => {
    setWsId("ws-1");
    renderDrawer(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with a titled drawer when invId is non-null", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderDrawer();
    expect(
      await screen.findByText("MAINTENANCE — Cordless Drill"),
    ).toBeInTheDocument();
  });

  it("renders a schedule row with title, interval, next due, and last done", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderDrawer();
    // SCHEDULE_A: Oil change, 180d, next_due 2026-07-01, last_completed_at set.
    const row = (await screen.findByText("Oil change")).closest("li")!;
    expect(within(row).getByText("every 180d")).toBeInTheDocument();
    expect(within(row).getByText(/Next due/)).toBeInTheDocument();
    expect(within(row).getByText(/2026-07-01/)).toBeInTheDocument();
    expect(within(row).getByText(/2026-01-02/)).toBeInTheDocument();
  });

  it("renders 'never' for a schedule with no last_completed_at", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderDrawer();
    // SCHEDULE_B: Filter replacement, no last_completed_at → "never".
    const row = (await screen.findByText("Filter replacement")).closest("li")!;
    expect(within(row).getByText(/Last done\s+never/)).toBeInTheDocument();
  });

  it("renders next_due as a NEUTRAL date with NO overdue cue (no ⚠, no danger tint)", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderDrawer();
    // SCHEDULE_B next_due 2026-06-10 is in the past relative to a 2026-06-13
    // "now", but the per-inventory endpoint carries NO is_overdue flag and the
    // drawer does ZERO client date math — so there must be no ⚠ cue anywhere.
    await screen.findByText("Filter replacement");
    expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Overdue/i)).not.toBeInTheDocument();
  });

  it("renders COMPLETE / EDIT / DELETE on each schedule row", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderDrawer();
    const row = (await screen.findByText("Oil change")).closest("li")!;
    expect(within(row).getByText("COMPLETE")).toBeInTheDocument();
    expect(within(row).getByText("EDIT")).toBeInTheDocument();
    expect(within(row).getByText("DELETE")).toBeInTheDocument();
  });

  it("clicking ADD SCHEDULE opens the MaintenanceForm create dialog", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderDrawer();
    await screen.findByText("Oil change");
    await userEvent.click(
      screen.getByRole("button", { name: /add schedule/i }),
    );
    expect(
      await screen.findByRole("dialog", { name: /add schedule/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("SAVE SCHEDULE")).toBeInTheDocument();
  });

  it("clicking COMPLETE opens the CompleteMaintenanceDialog", async () => {
    setWsId("ws-1");
    server.use(...maintenanceHandlers);
    renderDrawer();
    const row = (await screen.findByText("Oil change")).closest("li")!;
    await userEvent.click(within(row).getByText("COMPLETE"));
    expect(
      await screen.findByText("COMPLETE MAINTENANCE?"),
    ).toBeInTheDocument();
  });

  it("renders the NO SCHEDULES empty state for an empty fixture", async () => {
    setWsId("ws-1");
    server.use(
      http.get("/api/workspaces/:wsId/inventory/:invId/maintenance", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderDrawer();
    expect(await screen.findByText("NO SCHEDULES")).toBeInTheDocument();
  });
});
