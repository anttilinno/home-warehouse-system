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
import {
  repairHandlers,
  COST_MULTI_CURRENCY,
} from "@/test/msw/repairHandlers";
import { RepairsDrawer } from "./RepairsDrawer";

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
    <RepairsDrawer invId={invId} itemName="Cordless Drill" onClose={vi.fn()} />,
    { wrapper },
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("RepairsDrawer", () => {
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
    server.use(...repairHandlers);
    renderDrawer();
    expect(
      await screen.findByText("REPAIRS — Cordless Drill"),
    ).toBeInTheDocument();
  });

  it("renders a single-currency cost rollup with NO cross-currency sum", async () => {
    setWsId("ws-1");
    server.use(...repairHandlers);
    renderDrawer();
    // COST_SINGLE = EUR 25150 cents → €251.50 · 3 completed.
    expect(await screen.findByText(/251[.,]50/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("renders one stacked line per currency for a multi-currency rollup", async () => {
    setWsId("ws-1");
    server.use(
      http.get(
        "/api/workspaces/:wsId/inventory/:invId/repair-cost",
        () => HttpResponse.json({ items: COST_MULTI_CURRENCY }),
      ),
      ...repairHandlers,
    );
    renderDrawer();
    // EUR 16250 → €162.50 ; USD 8900 → $89.00 — two distinct lines, never summed.
    // (€251.50, the cross-currency sum, must NOT appear.)
    const eurLine = await screen.findByText(/162[.,]50/);
    const rollup = eurLine.closest("ul")!;
    expect(within(rollup).getByText(/162[.,]50/)).toBeInTheDocument();
    expect(within(rollup).getByText(/89[.,]00/)).toBeInTheDocument();
    expect(screen.queryByText(/251[.,]50/)).not.toBeInTheDocument();
  });

  it("renders one record-row per repair with the correct StatusPill", async () => {
    setWsId("ws-1");
    server.use(...repairHandlers);
    renderDrawer();
    expect(
      await screen.findByText("Replace worn brake pads"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("a PENDING row shows START + EDIT + DELETE", async () => {
    setWsId("ws-1");
    server.use(...repairHandlers);
    renderDrawer();
    const row = (await screen.findByText("Replace worn brake pads")).closest(
      "li",
    )!;
    expect(within(row).getByText("START")).toBeInTheDocument();
    expect(within(row).getByText("EDIT")).toBeInTheDocument();
    expect(within(row).getByText("DELETE")).toBeInTheDocument();
    expect(within(row).queryByText("COMPLETE")).not.toBeInTheDocument();
  });

  it("an IN_PROGRESS row shows COMPLETE + EDIT + DELETE", async () => {
    setWsId("ws-1");
    server.use(...repairHandlers);
    renderDrawer();
    const row = (await screen.findByText("Rebuild carburetor")).closest("li")!;
    expect(within(row).getByText("COMPLETE")).toBeInTheDocument();
    expect(within(row).getByText("EDIT")).toBeInTheDocument();
    expect(within(row).getByText("DELETE")).toBeInTheDocument();
    expect(within(row).queryByText("START")).not.toBeInTheDocument();
  });

  it("a COMPLETED row shows DELETE ONLY (no EDIT/START/COMPLETE)", async () => {
    setWsId("ws-1");
    server.use(...repairHandlers);
    renderDrawer();
    const row = (await screen.findByText("Swap timing belt")).closest("li")!;
    expect(within(row).getByText("DELETE")).toBeInTheDocument();
    expect(within(row).queryByText("EDIT")).not.toBeInTheDocument();
    expect(within(row).queryByText("START")).not.toBeInTheDocument();
    expect(within(row).queryByText("COMPLETE")).not.toBeInTheDocument();
  });

  it("clicking ADD REPAIR opens the RepairForm create dialog", async () => {
    setWsId("ws-1");
    server.use(...repairHandlers);
    renderDrawer();
    await screen.findByText("Replace worn brake pads");
    await userEvent.click(screen.getByText("⊕ ADD REPAIR"));
    expect(await screen.findByText("ADD REPAIR")).toBeInTheDocument();
    expect(screen.getByText("SAVE REPAIR")).toBeInTheDocument();
  });

  it("clicking COMPLETE on an IN_PROGRESS row opens CompleteRepairDialog", async () => {
    setWsId("ws-1");
    server.use(...repairHandlers);
    renderDrawer();
    const row = (await screen.findByText("Rebuild carburetor")).closest("li")!;
    await userEvent.click(within(row).getByText("COMPLETE"));
    expect(await screen.findByText("COMPLETE REPAIR")).toBeInTheDocument();
  });

  it("clicking START fires the start mutation (status settles to IN_PROGRESS)", async () => {
    setWsId("ws-1");
    let started = false;
    server.use(
      http.post("/api/workspaces/:wsId/repairs/:id/start", () => {
        started = true;
        return HttpResponse.json({
          id: "repair-pending",
          workspace_id: "ws-1",
          inventory_id: "inv-1",
          status: "IN_PROGRESS",
          description: "Replace worn brake pads",
          is_warranty_claim: false,
        });
      }),
      ...repairHandlers,
    );
    renderDrawer();
    const row = (await screen.findByText("Replace worn brake pads")).closest(
      "li",
    )!;
    await userEvent.click(within(row).getByText("START"));
    await waitFor(() => expect(started).toBe(true));
  });

  it("renders the NO REPAIRS empty state for an empty fixture", async () => {
    setWsId("ws-1");
    server.use(
      http.get(
        "/api/workspaces/:wsId/inventory/:invId/repair-cost",
        () => HttpResponse.json({ items: [] }),
      ),
      http.get(
        "/api/workspaces/:wsId/inventory/:invId/repairs",
        () => HttpResponse.json({ items: [], total: 0 }),
      ),
    );
    renderDrawer();
    expect(await screen.findByText("NO REPAIRS")).toBeInTheDocument();
  });
});
