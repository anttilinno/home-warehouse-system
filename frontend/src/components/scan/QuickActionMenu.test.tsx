import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { QuickActionMenu } from "./QuickActionMenu";
import type { Item } from "@/lib/types";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(id: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId: id,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  });
}

// byItem returns the BARE loan list; the api partitions on is_active.
function mockLoans(loans: unknown[]) {
  server.use(
    http.get("*/workspaces/ws-A/items/:id/loans", () =>
      HttpResponse.json(loans),
    ),
  );
}

function renderMenu(item: Item, onClose = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ModalStackProvider>
            <QuickActionMenu item={item} onClose={onClose} />
          </ModalStackProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { onClose };
}

const base = { id: "it-1", name: "Cordless Drill", barcode: "012", sku: "S1" };

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("QuickActionMenu", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
    setWsId("ws-A");
  });

  it("plain item: VIEW + LOAN + BACK, no UNARCHIVE / MARK REVIEWED", async () => {
    mockLoans([]);
    renderMenu(base as Item);
    expect(
      screen.getByRole("link", { name: /VIEW ITEM/ }),
    ).toHaveAttribute("href", "/items/it-1");
    // LOAN appears once the byItem query resolves with no active loan.
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /LOAN/ })).toHaveAttribute(
        "href",
        "/loans/new?itemId=it-1",
      ),
    );
    expect(screen.queryByRole("button", { name: /UNARCHIVE/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /MARK REVIEWED/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /BACK TO SCAN/ }),
    ).toBeInTheDocument();
  });

  it("hides LOAN while the byItem query is pending (fail-safe)", () => {
    // No resolved handler response yet at first paint → query pending.
    server.use(
      http.get(
        "*/workspaces/ws-A/items/:id/loans",
        () => new Promise(() => {}),
      ),
    );
    renderMenu(base as Item);
    expect(screen.queryByRole("link", { name: /LOAN/ })).toBeNull();
  });

  it("hides LOAN when an active loan exists", async () => {
    mockLoans([{ id: "l1", is_active: true }]);
    renderMenu(base as Item);
    // Give the query a tick; LOAN must never appear.
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /VIEW ITEM/ }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("link", { name: /LOAN/ })).toBeNull();
  });

  it("archived item: shows UNARCHIVE, hides LOAN", async () => {
    mockLoans([]);
    renderMenu({ ...base, is_archived: true } as Item);
    expect(
      await screen.findByRole("button", { name: /UNARCHIVE/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /LOAN/ })).toBeNull();
  });

  it("needs_review item: MARK REVIEWED PATCHes needs_review:false then closes", async () => {
    mockLoans([]);
    let captured: unknown = null;
    server.use(
      http.patch("*/workspaces/ws-A/items/it-1", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ id: "it-1", name: "Drill", sku: "S1" });
      }),
    );
    const { onClose } = renderMenu({ ...base, needs_review: true } as Item);
    await userEvent.click(
      await screen.findByRole("button", { name: /MARK REVIEWED/ }),
    );
    await waitFor(() => expect(captured).toEqual({ needs_review: false }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
