import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import {
  ShortcutsProvider,
  useShortcutsContext,
  type Shortcut,
} from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { ApprovalsPage } from "./ApprovalsPage";

// SYS-01 (Phase 14 Plan 01) — the /approvals review surface: pending activity
// table + Shift+Click multi-select + bulk Approve/Reject (per-id, partial-
// failure tolerant) + A/R shortcuts + a calm owner/admin 403 guard.

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [{ id: "ws-A", name: "Alpha", role: "owner" }],
    isLoading: false,
  });
}

function row(id: string, name: string) {
  return {
    id,
    workspace_id: "ws-A",
    requester_id: `u-${id}`,
    requester_name: name,
    requester_email: `${name.toLowerCase()}@test.local`,
    entity_type: "item",
    entity_id: `item-${id}`,
    action: "update",
    status: "pending",
    created_at: "2026-06-13T10:00:00Z",
  };
}

// A probe that publishes the merged shortcut registry so a test can assert
// which keys ApprovalsPage registered (mirrors the loans-page assertion).
let capturedShortcuts: Shortcut[] = [];
function ShortcutProbe() {
  capturedShortcuts = useShortcutsContext().shortcuts;
  return null;
}

function listHandler(rows: ReturnType<typeof row>[]) {
  return http.get("/api/workspaces/:ws/pending-changes", () =>
    HttpResponse.json({ changes: rows, total: rows.length }),
  );
}

function renderPage() {
  setWsId("ws-A");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = (children: ReactNode) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ShortcutsProvider>
          <ModalStackProvider>
            <RetroToaster />
            <MemoryRouter initialEntries={["/approvals"]}>
              <ShortcutProbe />
              {children}
            </MemoryRouter>
          </ModalStackProvider>
        </ShortcutsProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
  return render(wrapper(<ApprovalsPage />));
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  capturedShortcuts = [];
});

describe("ApprovalsPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the pending rows in a table (requester + entity + action + requested)", async () => {
    server.use(listHandler([row("pc-1", "Alex"), row("pc-2", "Sam")]));
    renderPage();

    expect(await screen.findByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    // requester email muted line
    expect(screen.getByText("alex@test.local")).toBeInTheDocument();
    // entity + action columns
    expect(screen.getAllByText(/item/i).length).toBeGreaterThan(0);
  });

  it("Shift+Click selects a contiguous range and the BulkActionBar shows the count", async () => {
    server.use(
      listHandler([
        row("pc-1", "Alex"),
        row("pc-2", "Sam"),
        row("pc-3", "Jordan"),
      ]),
    );
    renderPage();

    const r1 = (await screen.findByText("Alex")).closest("tr")!;
    const r3 = screen.getByText("Jordan").closest("tr")!;
    fireEvent.click(r1);
    fireEvent.click(r3, { shiftKey: true });

    // 3 selected → the BulkActionBar count chip reads "3 SELECTED".
    const bar = screen.getByRole("toolbar", { name: /bulk actions/i });
    expect(within(bar).getByText(/3\s*SELECTED/i)).toBeInTheDocument();
    // The selection set is id-keyed — three rows carry aria-selected.
    expect(document.querySelectorAll('tr[aria-selected="true"]')).toHaveLength(
      3,
    );
  });

  it("bulk Approve with 2 selected POSTs approve for BOTH ids and drops the rows", async () => {
    const user = userEvent.setup();
    const approved: string[] = [];
    server.use(
      listHandler([row("pc-1", "Alex"), row("pc-2", "Sam")]),
      http.post(
        "/api/workspaces/:ws/pending-changes/:id/approve",
        ({ params }) => {
          approved.push(String(params.id));
          return HttpResponse.json({
            id: String(params.id),
            status: "approved",
          });
        },
      ),
    );
    renderPage();

    const r1 = (await screen.findByText("Alex")).closest("tr")!;
    const r2 = screen.getByText("Sam").closest("tr")!;
    fireEvent.click(r1);
    fireEvent.click(r2, { shiftKey: true });

    // After selecting, an empty list will be served on refetch.
    server.use(listHandler([]));

    const bar = screen.getByRole("toolbar", { name: /bulk actions/i });
    await user.click(within(bar).getByRole("button", { name: /approve/i }));

    await waitFor(() => expect(approved.sort()).toEqual(["pc-1", "pc-2"]));
    // The list refetches empty → both rows drop.
    await waitFor(() =>
      expect(screen.queryByText("Alex")).not.toBeInTheDocument(),
    );
  });

  it("a 403 list renders a calm owner/admin guard, not the table", async () => {
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", () =>
        HttpResponse.json({ message: "forbidden" }, { status: 403 }),
      ),
    );
    renderPage();

    expect(await screen.findByText(/owners and admins/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("toolbar", { name: /bulk actions/i }),
    ).not.toBeInTheDocument();
  });

  it("registers the A and R shortcuts", async () => {
    server.use(listHandler([row("pc-1", "Alex")]));
    renderPage();
    await screen.findByText("Alex");

    const keys = capturedShortcuts.map((s) => s.key);
    expect(keys).toContain("A");
    expect(keys).toContain("R");
  });

  it("partial failure: one approve 500s → a partial toast and the surviving row stays", async () => {
    const user = userEvent.setup();
    server.use(
      listHandler([row("pc-1", "Alex"), row("pc-2", "Sam")]),
      http.post(
        "/api/workspaces/:ws/pending-changes/:id/approve",
        ({ params }) => {
          if (String(params.id) === "pc-2") {
            return HttpResponse.json({ message: "boom" }, { status: 500 });
          }
          return HttpResponse.json({
            id: String(params.id),
            status: "approved",
          });
        },
      ),
    );
    renderPage();

    const r1 = (await screen.findByText("Alex")).closest("tr")!;
    const r2 = screen.getByText("Sam").closest("tr")!;
    fireEvent.click(r1);
    fireEvent.click(r2, { shiftKey: true });

    // The post-batch refetch returns only the survivor (pc-2 / Sam).
    server.use(listHandler([row("pc-2", "Sam")]));

    const bar = screen.getByRole("toolbar", { name: /bulk actions/i });
    await user.click(within(bar).getByRole("button", { name: /approve/i }));

    // A partial-failure toast surfaces ("Approved 1, 1 failed").
    expect(await screen.findByText(/1 failed/i)).toBeInTheDocument();
    // The survivor row stays after the invalidate-driven refetch.
    expect(await screen.findByText("Sam")).toBeInTheDocument();
  });
});
