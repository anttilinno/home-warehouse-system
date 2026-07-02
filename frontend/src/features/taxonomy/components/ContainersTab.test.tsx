import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { containerApi } from "@/lib/api/container";
import { ContainersTab } from "./ContainersTab";

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

function renderTab(initialEntries: string[] = ["/taxonomy?tab=containers"]) {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ModalStackProvider>
            <RetroToaster />
            <ContainersTab />
          </ModalStackProvider>
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("ContainersTab", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders containers grouped under their resolved location headers", async () => {
    renderTab();
    // cont-1 → loc-1 (Garage); cont-2 → loc-2 (Shelf A).
    expect(await screen.findByText("Toolbox A")).toBeInTheDocument();
    expect(screen.getByText("Bin 3")).toBeInTheDocument();
    // Group headers carry the resolved location names.
    expect(screen.getByText("Garage")).toBeInTheDocument();
    expect(screen.getByText("Shelf A")).toBeInTheDocument();
  });

  it("buckets containers with an unresolved location under (No location) LAST", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/containers", () =>
        HttpResponse.json({
          items: [
            {
              id: "cont-1",
              workspace_id: "ws-1",
              name: "Toolbox A",
              location_id: "loc-1",
              is_archived: false,
              created_at: "2026-06-13T00:00:00Z",
              updated_at: "2026-06-13T00:00:00Z",
            },
            {
              id: "cont-orphan",
              workspace_id: "ws-1",
              name: "Lost Bin",
              location_id: "loc-gone",
              is_archived: false,
              created_at: "2026-06-13T00:00:00Z",
              updated_at: "2026-06-13T00:00:00Z",
            },
          ],
          total: 2,
          page: 1,
          total_pages: 1,
        }),
      ),
    );
    renderTab();
    await screen.findByText("Lost Bin");
    const headers = screen.getAllByText(/Garage|\(No location\)/);
    // (No location) sorts LAST after the resolved Garage group.
    expect(headers[headers.length - 1].textContent).toMatch(/\(No location\)/);
  });

  it("⊕ ADD CONTAINER opens the inline create dialog", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Toolbox A");
    await user.click(screen.getByRole("button", { name: /add container/i }));
    expect(await screen.findByText(/NEW CONTAINER/i)).toBeInTheDocument();
  });

  it("?new_code deep-link (scan/claim) auto-opens create with short_code seeded", async () => {
    renderTab(["/taxonomy?tab=containers&new_code=BOX9"]);
    // Dialog opens without an Add click, short_code prefilled from the scan.
    expect(await screen.findByText(/NEW CONTAINER/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("BOX9")).toBeInTheDocument();
  });

  it("deleting a container WITH items shows the cascade count copy then bare-deletes", async () => {
    const user = userEvent.setup();
    // Surface a non-zero usage count for the inventory?container_id read.
    server.use(
      http.get("/api/workspaces/:wsId/inventory", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has("container_id")) {
          return HttpResponse.json({
            items: [],
            total: 5,
            page: 1,
            total_pages: 1,
          });
        }
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          total_pages: 0,
        });
      }),
    );
    const delSpy = vi.spyOn(containerApi, "del");
    renderTab();
    const row = (await screen.findByText("Toolbox A")).closest(
      "tr",
    ) as HTMLElement;

    await user.click(
      within(row).getByRole("button", { name: /delete toolbox a/i }),
    );
    // The count-aware cascade copy appears once the count resolves.
    expect(await screen.findByText(/holds 5 items/i)).toBeInTheDocument();
    expect(
      screen.getByText(/they stay in their location/i),
    ).toBeInTheDocument();
    // Confirm fires a single bare DELETE.
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(delSpy).toHaveBeenCalledWith("ws-1", "cont-1"));
    expect(delSpy).toHaveBeenCalledTimes(1);
  });

  it("deleting a container with 0 items shows the plain pink confirm", async () => {
    const user = userEvent.setup();
    // Default inventory?container_id read returns total:0.
    const delSpy = vi.spyOn(containerApi, "del");
    renderTab();
    const row = (await screen.findByText("Toolbox A")).closest(
      "tr",
    ) as HTMLElement;

    await user.click(
      within(row).getByRole("button", { name: /delete toolbox a/i }),
    );
    expect(
      await screen.findByText(/This can't be undone/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/holds/i)).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(delSpy).toHaveBeenCalledWith("ws-1", "cont-1"));
  });

  it("renders the empty state when there are no containers", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/containers", () =>
        HttpResponse.json({ items: [], total: 0, page: 1, total_pages: 0 }),
      ),
    );
    renderTab();
    expect(await screen.findByText(/NO CONTAINERS YET/i)).toBeInTheDocument();
  });

  it("renders the error state with a RETRY action on a load failure", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/containers", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderTab();
    expect(
      await screen.findByText(/COULDN'T LOAD CONTAINERS/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
