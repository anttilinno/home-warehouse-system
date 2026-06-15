import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, useLocation } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import CommandPalette from "../CommandPalette";
import { getRecent } from "../recentActions";
import { entitySearchHandlers, ENTITY_FIXTURES } from "./entitySearch.msw";

// cmdk subscribes a ResizeObserver on its list; jsdom ships none. Stub it here
// (scoped to this spec — the shared setup is owned by other plans) so the palette
// mounts without `ResizeObserver is not defined`.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??=
  ResizeObserverStub;

// cmdk scrolls the active item into view on selection; jsdom Elements have no
// scrollIntoView. No-op it (scoped to this spec).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

// TUI-05 + §4 — the cmdk palette body. Mocks the workspace context (the only
// app-context dependency); MSW backs the 4 entity-search endpoints; a router
// probe surfaces the live URL so navigation is asserted by path, not by spy.

const setWorkspace = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => ({
    currentWorkspaceId: "ws-1",
    setWorkspace,
    workspaces: [
      { id: "ws-1", name: "Alpha Home" },
      { id: "ws-2", name: "Beta Garage" },
    ],
    isLoading: false,
  }),
}));

let lastPath = "";
function LocationProbe() {
  const loc = useLocation();
  lastPath = `${loc.pathname}${loc.search}`;
  return null;
}

function renderPalette(onClose = vi.fn()) {
  localStorage.clear();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <ModalStackProvider>
            <LocationProbe />
            <CommandPalette open onClose={onClose} />
          </ModalStackProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { ...utils, onClose };
}

describe("CommandPalette", () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders the palette root with a stable testid", () => {
    renderPalette();
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
  });

  it("renders the static Routes group (Dashboard, Items, Settings)", () => {
    renderPalette();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("client-filters the static groups as the user types", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByRole("combobox"), "settings");

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("ArrowDown + Enter navigates to the selected route, records MRU, and closes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPalette();

    const input = screen.getByRole("combobox");
    await user.type(input, "items");
    // Move selection onto the (sole) filtered "Items" row, then activate it.
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(lastPath).toBe("/items"));
    expect(onClose).toHaveBeenCalled();
    const recent = getRecent();
    expect(recent[0].to).toBe("/items");
  });

  it("selecting a workspace row calls setWorkspace then closes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPalette();

    await user.type(screen.getByRole("combobox"), "Beta");
    const row = await screen.findByText("Beta Garage");
    await user.click(row);

    expect(setWorkspace).toHaveBeenCalledWith("ws-2");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows debounced entity-search results and navigates an item row to its detail route", async () => {
    server.use(...entitySearchHandlers);
    const user = userEvent.setup();
    const { onClose } = renderPalette();

    await user.type(screen.getByRole("combobox"), "wrench");

    const itemRow = await screen.findByText(
      ENTITY_FIXTURES.item.name,
      {},
      {
        timeout: 2000,
      },
    );
    await user.click(itemRow);

    await waitFor(() =>
      expect(lastPath).toBe(`/items/${ENTITY_FIXTURES.item.id}`),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("closes via the modal stack on ESC", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPalette();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});
