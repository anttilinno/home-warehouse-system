import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { locationApi } from "@/lib/api/location";
import { LocationsTab } from "./LocationsTab";

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

function renderTab() {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <LocationsTab />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("LocationsTab", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders root locations from the tree (Garage); child Shelf A is nested", async () => {
    renderTab();
    // Garage is the only root (Shelf A nests under it via parent_location).
    expect(await screen.findByText("Garage")).toBeInTheDocument();
    // Shelf A is a child — hidden until Garage is expanded.
    expect(screen.queryByText("Shelf A")).not.toBeInTheDocument();
  });

  it("expanding a root reveals its nested child (parent_location)", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Garage");
    await user.click(screen.getByText("Garage"));
    // Shelf A nests under Garage via parent_location (NOT _id — Pitfall 6).
    expect(await screen.findByText("Shelf A")).toBeInTheDocument();
  });

  it("⊕ ADD ROOT LOCATION opens the inline create dialog", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Garage");
    await user.click(
      screen.getByRole("button", { name: /add root location/i }),
    );
    expect(await screen.findByText(/NEW LOCATION/i)).toBeInTheDocument();
  });

  it("offers NO delete affordance anywhere (archive-only, TAX-04)", async () => {
    const user = userEvent.setup();
    renderTab();
    const garageRow = (await screen.findByText("Garage")).closest(
      '[role="treeitem"]',
    ) as HTMLElement;
    // The row exposes EDIT / add-child / archive — never delete.
    expect(
      within(garageRow).queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
    expect(
      within(garageRow).getByRole("button", { name: /archive/i }),
    ).toBeInTheDocument();
    // Opening the archive confirm surfaces the plain butter copy (no count).
    await user.click(
      within(garageRow).getByRole("button", { name: /archive/i }),
    );
    expect(
      await screen.findByText(/You can restore it later/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/items assigned/i)).not.toBeInTheDocument();
  });

  it("archiving a location calls locationApi.archive (plain confirm)", async () => {
    const user = userEvent.setup();
    const archiveSpy = vi.spyOn(locationApi, "archive");
    renderTab();
    const garageRow = (await screen.findByText("Garage")).closest(
      '[role="treeitem"]',
    ) as HTMLElement;

    await user.click(
      within(garageRow).getByRole("button", { name: /archive/i }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /^archive$/i }),
    );
    await waitFor(() =>
      expect(archiveSpy).toHaveBeenCalledWith("ws-1", "loc-1"),
    );
  });

  it("restore on an archived row calls locationApi.restore", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/locations", () =>
        HttpResponse.json({
          items: [
            {
              id: "loc-archived",
              workspace_id: "ws-1",
              name: "Old Shed",
              is_archived: true,
              created_at: "2026-06-13T00:00:00Z",
              updated_at: "2026-06-13T00:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          total_pages: 1,
        }),
      ),
    );
    const restoreSpy = vi.spyOn(locationApi, "restore");
    renderTab();
    const row = (await screen.findByText("Old Shed")).closest(
      '[role="treeitem"]',
    ) as HTMLElement;

    await user.click(within(row).getByRole("button", { name: /restore/i }));
    await waitFor(() =>
      expect(restoreSpy).toHaveBeenCalledWith("ws-1", "loc-archived"),
    );
  });

  it("renders the empty state when there are no locations", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/locations", () =>
        HttpResponse.json({ items: [], total: 0, page: 1, total_pages: 0 }),
      ),
    );
    renderTab();
    expect(await screen.findByText(/NO LOCATIONS YET/i)).toBeInTheDocument();
  });

  it("renders the error state with a RETRY action on a load failure", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/locations", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderTab();
    expect(
      await screen.findByText(/COULDN'T LOAD LOCATIONS/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
