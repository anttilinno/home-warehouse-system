import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { RetroToaster } from "@/components/retro";
import type { Item } from "@/lib/types";
import { ClaimPage } from "./ClaimPage";

const WS = "ws-A";

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

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "it-1",
    workspace_id: WS,
    sku: "SKU-1",
    name: "Cordless Drill",
    description: "A handy drill",
    barcode: "BC-12345",
    min_stock_level: 4,
    short_code: "code-1",
    is_archived: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-10T00:00:00Z",
    ...overrides,
  };
}

interface Fixtures {
  item?: Item | null;
  status?: number;
}

function installHandlers(f: Fixtures) {
  server.use(
    http.get("/api/workspaces/:wsId/items/by-barcode/:code", () => {
      if (f.status && f.status !== 200) {
        return new HttpResponse(null, { status: f.status });
      }
      return HttpResponse.json(f.item ?? makeItem());
    }),
  );
}

// Surfaces the current pathname + search so navigation assertions are exact.
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function renderClaim(code: string) {
  setWsId(WS);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RetroToaster />
        {/* Encode the code into the path exactly as a real browser would —
            an unencoded slash in :code would otherwise split the route. */}
        <MemoryRouter initialEntries={[`/claim/${encodeURIComponent(code)}`]}>
          <LocationProbe />
          <Routes>
            <Route path="/claim/:code" element={<ClaimPage />} />
            <Route path="/items/:id" element={<div>ITEM DETAIL</div>} />
            <Route path="/items/new" element={<div>NEW ITEM FORM</div>} />
            <Route path="/scan" element={<div>SCAN PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("ClaimPage (/claim/:code — PORT LEGACY create-entity, SCAN-12)", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("shows a RESOLVING state while the lookup is in flight", () => {
    installHandlers({ item: makeItem() });
    renderClaim("0123456789");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/resolving/i)).toBeInTheDocument();
  });

  it("MATCH → navigates to the matched item detail (/items/:id)", async () => {
    installHandlers({ item: makeItem({ id: "it-99" }) });
    renderClaim("0123456789");
    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent("/items/it-99");
    });
    expect(screen.getByText("ITEM DETAIL")).toBeInTheDocument();
  });

  it("404 → UNRESOLVABLE: offers CREATE ITEM WITH THIS CODE → /items/new?barcode=<encoded>", async () => {
    installHandlers({ status: 404 });
    renderClaim("AB/CD 12");
    const link = await screen.findByRole("link", {
      name: /create item with this code/i,
    });
    // encodeURIComponent("AB/CD 12") === "AB%2FCD%2012"
    expect(link).toHaveAttribute("href", "/items/new?barcode=AB%2FCD%2012");
  });

  it("404 → also renders a CODE NOT FOUND empty-state with BACK TO SCAN → /scan", async () => {
    const user = userEvent.setup();
    installHandlers({ status: 404 });
    renderClaim("nope");
    expect(await screen.findByText(/code not found/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back to scan/i }));
    await waitFor(() => {
      expect(screen.getByTestId("loc")).toHaveTextContent("/scan");
    });
  });

  it("encodeURIComponents the code in the create link (Pitfall 5)", async () => {
    installHandlers({ status: 404 });
    renderClaim("..%2Fetc");
    const link = await screen.findByRole("link", {
      name: /create item with this code/i,
    });
    const href = link.getAttribute("href") ?? "";
    // No raw slash from the decoded ../etc may leak into the create URL.
    expect(href).not.toContain("/etc");
    expect(href).toContain("/items/new?barcode=");
  });

  it("lookup error (500) → role=alert danger banner + a toast", async () => {
    installHandlers({ status: 500 });
    renderClaim("boom");
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    // Sonner renders the toast text into the DOM.
    await waitFor(() => {
      expect(
        screen.getAllByText(/couldn't resolve|could not resolve/i).length,
      ).toBeGreaterThan(0);
    });
  });
});
