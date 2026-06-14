import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { categoryApi } from "@/lib/api/category";
import { CategoriesTab } from "./CategoriesTab";

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
          <MemoryRouter initialEntries={["/taxonomy?tab=categories"]}>
            <Routes>
              <Route path="/taxonomy" element={<CategoriesTab />} />
              <Route
                path="/taxonomy/categories/new"
                element={<div>NEW CATEGORY FORM</div>}
              />
              <Route
                path="/taxonomy/categories/:id/edit"
                element={<div>EDIT CATEGORY FORM</div>}
              />
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

describe("CategoriesTab", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders root categories from the tree (Electronics + Tools)", async () => {
    renderTab();
    // Two roots from the MSW fixture (Phones nests under Electronics, collapsed).
    expect(await screen.findByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
    // Phones is a child — hidden until Electronics is expanded.
    expect(screen.queryByText("Phones")).not.toBeInTheDocument();
  });

  it("expanding a root reveals its nested child", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Electronics");
    // Click the Electronics row toggles expansion.
    await user.click(screen.getByText("Electronics"));
    expect(await screen.findByText("Phones")).toBeInTheDocument();
  });

  it("⊕ ADD ROOT CATEGORY navigates to the create form", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: /add root category/i }));
    expect(await screen.findByText("NEW CATEGORY FORM")).toBeInTheDocument();
  });

  it("archiving a category WITH items shows the count copy then archives", async () => {
    const user = userEvent.setup();
    // Surface a non-zero usage count for the items?category_id read.
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json({ items: [], total: 4, page: 1, total_pages: 1 }),
      ),
    );
    const archiveSpy = vi.spyOn(categoryApi, "archive");
    renderTab();
    const toolsRow = (await screen.findByText("Tools")).closest(
      '[role="treeitem"]',
    ) as HTMLElement;

    await user.click(within(toolsRow).getByRole("button", { name: /archive/i }));

    // The count-aware copy appears once the count resolves.
    expect(await screen.findByText(/4 items assigned/i)).toBeInTheDocument();
    // Confirm fires the archive.
    await user.click(screen.getByRole("button", { name: /archive anyway/i }));
    await waitFor(() =>
      expect(archiveSpy).toHaveBeenCalledWith("ws-1", "cat-tools"),
    );
  });

  it("archiving a category with 0 items shows the plain confirm", async () => {
    const user = userEvent.setup();
    // Default MSW items?category_id read returns total:0.
    const archiveSpy = vi.spyOn(categoryApi, "archive");
    renderTab();
    const toolsRow = (await screen.findByText("Tools")).closest(
      '[role="treeitem"]',
    ) as HTMLElement;

    await user.click(within(toolsRow).getByRole("button", { name: /archive/i }));

    expect(
      await screen.findByText(/You can restore it later/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/items assigned/i),
    ).not.toBeInTheDocument();
    // Scope to the dialog so the row's ⌫ ARCHIVE aria-label button is excluded.
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));
    await waitFor(() =>
      expect(archiveSpy).toHaveBeenCalledWith("ws-1", "cat-tools"),
    );
  });

  it("restore on an archived row calls categoryApi.restore", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/categories", () =>
        HttpResponse.json({
          items: [
            {
              id: "cat-archived",
              workspace_id: "ws-1",
              name: "Archived Cat",
              is_archived: true,
              created_at: "2026-06-13T00:00:00Z",
              updated_at: "2026-06-13T00:00:00Z",
            },
          ],
        }),
      ),
    );
    const restoreSpy = vi.spyOn(categoryApi, "restore");
    renderTab();
    const row = (await screen.findByText("Archived Cat")).closest(
      '[role="treeitem"]',
    ) as HTMLElement;

    await user.click(within(row).getByRole("button", { name: /restore/i }));
    await waitFor(() =>
      expect(restoreSpy).toHaveBeenCalledWith("ws-1", "cat-archived"),
    );
  });

  it("renders the empty state when there are no categories", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/categories", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderTab();
    expect(await screen.findByText(/NO CATEGORIES YET/i)).toBeInTheDocument();
  });

  it("renders the error state with a RETRY action on a load failure", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/categories", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderTab();
    expect(
      await screen.findByText(/COULDN'T LOAD CATEGORIES/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
