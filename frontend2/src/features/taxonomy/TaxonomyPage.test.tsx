import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route, useSearchParams } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { TaxonomyPage } from "./TaxonomyPage";

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

// Surface the current ?tab= so the round-trip can be asserted.
function TabProbe() {
  const [params] = useSearchParams();
  return <span data-testid="tab-probe">{params.get("tab") ?? ""}</span>;
}

function renderPage(initialEntries: string[] = ["/taxonomy"]) {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter initialEntries={initialEntries}>
            <TabProbe />
            <Routes>
              <Route path="/taxonomy" element={<TaxonomyPage />} />
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

describe("TaxonomyPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the mint TAXONOMY window with all four tabs, categories default", async () => {
    renderPage();
    // The four folder tabs.
    expect(screen.getByRole("tab", { name: /categories/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /locations/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /containers/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /labels/i })).toBeInTheDocument();
    // Categories selected by default → its tree (or toolbar) renders.
    expect(
      screen.getByRole("tab", { name: /categories/i }),
    ).toHaveAttribute("aria-selected", "true");
    // The categories toolbar action proves the live CategoriesTab mounted.
    expect(
      await screen.findByRole("button", { name: /add root category/i }),
    ).toBeInTheDocument();
  });

  it("loading /taxonomy?tab=locations selects the live LocationsTab panel", async () => {
    renderPage(["/taxonomy?tab=locations"]);
    expect(
      screen.getByRole("tab", { name: /locations/i }),
    ).toHaveAttribute("aria-selected", "true");
    // 10-03 filled the stub in-place; the live LocationsTab toolbar proves it.
    expect(
      await screen.findByRole("button", { name: /add root location/i }),
    ).toBeInTheDocument();
  });

  it("clicking the Locations tab round-trips ?tab=locations into the URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: /add root category/i });

    await user.click(screen.getByRole("tab", { name: /locations/i }));

    await waitFor(() =>
      expect(screen.getByTestId("tab-probe")).toHaveTextContent("locations"),
    );
    // 10-03 filled the stub in-place; the live LocationsTab toolbar proves it.
    expect(
      await screen.findByRole("button", { name: /add root location/i }),
    ).toBeInTheDocument();
  });

  it("an unknown ?tab= falls back to categories", async () => {
    renderPage(["/taxonomy?tab=bogus"]);
    expect(
      screen.getByRole("tab", { name: /categories/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      await screen.findByRole("button", { name: /add root category/i }),
    ).toBeInTheDocument();
  });
});
