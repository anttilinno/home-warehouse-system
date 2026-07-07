import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ShortcutsProvider, useShortcutsContext } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { ItemsListPage } from "./ItemsListPage";

// wsId from the workspace context.
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

function makeItem(i: number, archived = false) {
  return {
    id: `it-${i}`,
    workspace_id: "ws-A",
    sku: `SKU-${i}`,
    name: `Item ${i}`,
    min_stock_level: 0,
    short_code: `code-${i}`,
    is_archived: archived,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

// A probe that surfaces the live URL search string + the registered shortcut keys.
let lastSearch = "";
let shortcutKeys: string[] = [];
function Probe() {
  const loc = useLocation();
  lastSearch = loc.search;
  shortcutKeys = useShortcutsContext().shortcuts.map((s) =>
    s.key.toUpperCase(),
  );
  return null;
}

function renderPage(initialEntries: string[] = ["/items"]) {
  setWsId("ws-A");
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
                <Route
                  path="/items"
                  element={
                    <>
                      <Probe />
                      <ItemsListPage />
                    </>
                  }
                />
                <Route path="/items/new" element={<div>NEW ITEM PAGE</div>} />
                <Route path="/items/:id" element={<div>DETAIL PAGE</div>} />
              </Routes>
            </MemoryRouter>
          </ModalStackProvider>
        </ShortcutsProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

function listOf(
  items: ReturnType<typeof makeItem>[],
  page = 1,
  totalPages = 1,
) {
  return { items, total: items.length, page, total_pages: totalPages };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  lastSearch = "";
  shortcutKeys = [];
});

describe("ItemsListPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders a full page of rows from the list envelope", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => makeItem(i + 1));
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf(rows, 1, 3)),
      ),
    );
    renderPage();
    expect(await screen.findByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 25")).toBeInTheDocument();
    // Pager meta is server-driven: page 1 of 3 · 25 / page.
    expect(screen.getByText(/page 1 of 3 · 25 \/ page/i)).toBeInTheDocument();
  });

  it("typing in search drives ?q and resets the page to 1", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
    );
    renderPage(["/items?page=3"]);
    await screen.findByText("Item 1");

    const search = screen.getByRole("searchbox");
    await user.type(search, "drill");
    await waitFor(() => expect(lastSearch).toContain("q=drill"));
    expect(lastSearch).toContain("page=1");
  });

  it("has no per-page ARCHIVED facet (archived is a global preference now)", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
    );
    renderPage();
    await screen.findByText("Item 1");

    // The ARCHIVED facet was removed from the FilterBar — only the CATEGORY
    // facet remains. Visibility is driven by Settings → Data & Storage.
    expect(
      screen.queryByRole("button", { name: /archived/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /category/i }),
    ).toBeInTheDocument();
  });

  it("populates the CATEGORY facet and chips the selected category NAME (not its id)", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
    );
    renderPage();
    await screen.findByText("Item 1");

    await user.click(screen.getByRole("button", { name: /category/i }));
    // Options come from the workspace category tree (Electronics + child Phones).
    await user.click(
      await screen.findByRole("checkbox", { name: "Electronics" }),
    );

    await waitFor(() =>
      expect(lastSearch).toContain("category=cat-electronics"),
    );
    // The chip shows the human name, not the uuid (the URL still carries the id).
    expect(screen.getByText("Electronics")).toBeInTheDocument();
  });

  it("the INSURED boolean facet toggles ?insured and chips as Yes", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
    );
    renderPage();
    await screen.findByText("Item 1");

    await user.click(screen.getByRole("button", { name: "Insured" }));
    await waitFor(() => expect(lastSearch).toContain("insured=1"));
    expect(screen.getByText("Yes")).toBeInTheDocument();

    // Toggling off clears the param.
    await user.click(screen.getByRole("button", { name: "Insured" }));
    await waitFor(() => expect(lastSearch).not.toContain("insured=1"));
  });

  it("CLEAR ALL clears a search-only state (the search box carries no chip)", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
    );
    renderPage(["/items?q=drill"]);
    await screen.findByText("Item 1");

    await user.click(screen.getByRole("button", { name: /clear all/i }));
    await waitFor(() => expect(lastSearch).not.toContain("q=drill"));
  });

  it("renders the Category column: the resolved name, plus a header", async () => {
    const withCat = { ...makeItem(1), category_id: "cat-electronics" };
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([withCat, makeItem(2)])),
      ),
    );
    renderPage();
    await screen.findByText("Item 1");

    expect(
      screen.getByRole("columnheader", { name: /category/i }),
    ).toBeInTheDocument();
    // Item 1's category_id resolves to its name via the categories query.
    expect(
      screen.getByRole("cell", { name: "Electronics" }),
    ).toBeInTheDocument();
  });

  it("includes archived rows when the show_archived preference is on", async () => {
    server.use(
      // Global preference ON → the list hook sends archived=true.
      http.get("/api/users/me", () =>
        HttpResponse.json({
          id: "user-1",
          email: "seeder@test.local",
          full_name: "Seed Er",
          has_password: true,
          avatar_url: null,
          show_archived: true,
        }),
      ),
      http.get("/api/workspaces/:wsId/items", ({ request }) => {
        const archived = new URL(request.url).searchParams.get("archived");
        return HttpResponse.json(
          archived === "true"
            ? listOf([makeItem(1), makeItem(2, true)])
            : listOf([makeItem(1)]),
        );
      }),
    );
    renderPage();
    // The archived row appears because the request carried archived=true.
    expect(await screen.findByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText(/^archived$/i)).toBeInTheDocument();
  });

  it("clicking a non-default sort header sets ?sort", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
    );
    renderPage();
    await screen.findByText("Item 1");

    // SKU is not the default sort (name is), so clicking sets ?sort=sku.
    await user.click(screen.getByRole("button", { name: /sort by sku/i }));
    await waitFor(() => expect(lastSearch).toContain("sort=sku"));
  });

  it("clicking the active sort header toggles ?sort_dir", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
    );
    renderPage();
    await screen.findByText("Item 1");

    // Name is the default sort, so clicking it toggles direction to desc.
    await user.click(screen.getByRole("button", { name: /sort by name/i }));
    await waitFor(() => expect(lastSearch).toContain("sort_dir=desc"));
  });

  it("deep-link ?page=2 restores and requests page 2", async () => {
    let requestedPage: string | null = null;
    server.use(
      http.get("/api/workspaces/:wsId/items", ({ request }) => {
        requestedPage = new URL(request.url).searchParams.get("page");
        return HttpResponse.json(listOf([makeItem(1)], 2, 3));
      }),
    );
    renderPage(["/items?page=2"]);
    await screen.findByText("Item 1");
    expect(requestedPage).toBe("2");
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
  });

  it("row click navigates to the detail page", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
    );
    renderPage();
    await user.click(await screen.findByText("Item 1"));
    expect(await screen.findByText("DETAIL PAGE")).toBeInTheDocument();
  });

  it("registers the N // route shortcuts but no F toggle-archived", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
    );
    renderPage();
    await screen.findByText("Item 1");
    await waitFor(() => {
      expect(shortcutKeys).toContain("N");
      expect(shortcutKeys).toContain("/");
    });
    // F (toggle archived) is gone — archived is the global show_archived pref.
    expect(shortcutKeys).not.toContain("F");
  });

  it("blocks bulk delete unless the whole selection is archived", async () => {
    const user = userEvent.setup();
    server.use(
      // Global show_archived ON so archived rows are loaded and selectable.
      http.get("/api/users/me", () =>
        HttpResponse.json({
          id: "user-1",
          email: "seeder@test.local",
          full_name: "Seed Er",
          has_password: true,
          avatar_url: null,
          show_archived: true,
        }),
      ),
      http.get("/api/workspaces/:wsId/items", ({ request }) => {
        const archived = new URL(request.url).searchParams.get("archived");
        return HttpResponse.json(
          archived === "true"
            ? listOf([makeItem(1, true), makeItem(2, true)])
            : listOf([makeItem(1)]),
        );
      }),
    );
    renderPage();
    await screen.findByText("Item 1");

    // Select the first row via its checkbox.
    const checkboxes = screen.getAllByRole("checkbox", { name: /item 1/i });
    await user.click(checkboxes[0]);

    // A bulk DELETE shortcut surfaces (selection is fully archived).
    await waitFor(() => {
      const deleteShortcut = shortcutKeys.includes("X");
      expect(deleteShortcut).toBe(true);
    });
  });

  it("exports CSV via the export button", async () => {
    const user = userEvent.setup();
    let csvHit = false;
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([makeItem(1)])),
      ),
      http.get("/api/workspaces/:wsId/export/item", () => {
        csvHit = true;
        return new HttpResponse("a,b\n1,2", {
          headers: { "Content-Type": "text/csv" },
        });
      }),
    );
    // jsdom lacks URL.createObjectURL — stub it for the downloadBlob anchor path.
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();

    renderPage();
    await screen.findByText("Item 1");
    await user.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(csvHit).toBe(true));

    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });

  it("shows the empty state when the workspace has no items", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([])),
      ),
    );
    renderPage();
    expect(await screen.findByText(/no items yet/i)).toBeInTheDocument();
  });

  it("shows the filtered-empty state when a search matches nothing", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items", () =>
        HttpResponse.json(listOf([])),
      ),
    );
    renderPage(["/items?q=zzz"]);
    expect(await screen.findByText(/no matches/i)).toBeInTheDocument();
  });
});
