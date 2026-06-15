import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import type { DeclutterItem } from "@/lib/api/declutter";
import { DeclutterPage } from "./DeclutterPage";

// Phase 14 Plan 04 Task 3 — DeclutterPage integration test. MSW backs the list
// + mark-used; the CSV download is asserted via a spy on triggerCsvDownload.

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
        id: "ws-A",
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

// Spy on the CSV download trigger (the page imports it from declutterCsv).
const triggerCsvDownloadMock = vi.fn();
vi.mock("./declutterCsv", async () => {
  const actual =
    await vi.importActual<typeof import("./declutterCsv")>("./declutterCsv");
  return {
    ...actual,
    triggerCsvDownload: (...args: unknown[]) => triggerCsvDownloadMock(...args),
  };
});

function makeRow(over: Partial<DeclutterItem> = {}): DeclutterItem {
  return {
    id: "inv-1",
    item_id: "it-1",
    item_name: "Cordless Drill",
    item_sku: "SKU-1",
    location_id: "loc-1",
    location_name: "Garage",
    category_id: "cat-1",
    category_name: "Tools",
    quantity: 1,
    days_unused: 200,
    score: 88,
    purchase_price: 4999,
    currency_code: "EUR",
    last_used_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <MemoryRouter>
            <DeclutterPage />
            <RetroToaster />
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

describe("DeclutterPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
    setWsId("ws-A");
  });

  it("renders rows with item, score badge, days_unused and a null-safe price", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/declutter", () =>
        HttpResponse.json({
          // one normal row + a null-currency row (must NOT white-screen).
          items: [
            makeRow(),
            makeRow({
              id: "inv-2",
              item_name: "Old Lamp",
              currency_code: null,
              purchase_price: 1000,
              score: 20,
              days_unused: 365,
            }),
          ],
          total: 2,
        }),
      ),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Cordless Drill")).toBeInTheDocument(),
    );
    // score badge text present
    expect(screen.getByText("88")).toBeInTheDocument();
    // days_unused
    expect(screen.getByText("200")).toBeInTheDocument();
    // null-currency row renders (no crash) — its name is shown
    expect(screen.getByText("Old Lamp")).toBeInTheDocument();
  });

  it("re-queries when the group_by select changes", async () => {
    const requested: string[] = [];
    server.use(
      http.get("/api/workspaces/:wsId/declutter", ({ request }) => {
        requested.push(new URL(request.url).search);
        return HttpResponse.json({ items: [makeRow()], total: 1 });
      }),
    );

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Cordless Drill")).toBeInTheDocument(),
    );

    const select = screen.getByLabelText(/group/i);
    await userEvent.selectOptions(select, "category");

    await waitFor(() =>
      expect(requested.some((s) => s.includes("group_by=category"))).toBe(true),
    );
  });

  it("EXPORT CSV triggers a download of the current rows", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/declutter", () =>
        HttpResponse.json({ items: [makeRow()], total: 1 }),
      ),
    );

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Cordless Drill")).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(triggerCsvDownloadMock).toHaveBeenCalledTimes(1);
  });

  it("mark used fires mark-used and drops the row on refetch", async () => {
    let marked = false;
    server.use(
      http.get("/api/workspaces/:wsId/declutter", () =>
        HttpResponse.json({
          items: marked ? [] : [makeRow()],
          total: marked ? 0 : 1,
        }),
      ),
      http.post(
        "/api/workspaces/:wsId/inventory/:inventoryId/mark-used",
        () => {
          marked = true;
          return HttpResponse.json({ success: true, message: "ok" });
        },
      ),
    );

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Cordless Drill")).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /mark used/i }));
    // confirm dialog → click the confirm verb
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /mark used/i }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Cordless Drill")).not.toBeInTheDocument(),
    );
  });

  it("shows a calm empty state when there is nothing to declutter", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/declutter", () =>
        HttpResponse.json({ items: [], total: 0 }),
      ),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/nothing to declutter/i)).toBeInTheDocument(),
    );
    // export disabled when empty
    expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
  });
});
