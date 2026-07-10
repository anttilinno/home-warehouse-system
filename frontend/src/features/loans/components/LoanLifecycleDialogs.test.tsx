import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { registerMutationDefaults } from "@/lib/offline/mutationDefaults";
import type { Loan } from "@/lib/types";
import { EditLoanDialog } from "./EditLoanDialog";
import { ExtendLoanDialog } from "./ExtendLoanDialog";
import { ReturnLoanDialog } from "./ReturnLoanDialog";

// Phase 4 Plan 4.4 (test-gap PLAN-test-gaps.md) — loans lifecycle dialogs.
// Submit + validation-error path only. None of these three carry a zod
// schema (unlike the taxonomy FormDialogs), so "validation-error" here means
// the two real client-side/server-side failure shapes: ExtendLoanDialog's
// required-date guard (Extend disabled when the date is cleared, mirroring
// R10) and, for the other two, a rejected mutation not closing the dialog
// (useLoanMutations onError never calls onClose — no false-positive close on
// a 4xx).

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

function makeLoan(over: Partial<Loan> = {}): Loan {
  return {
    id: "loan-1",
    workspace_id: "ws-1",
    inventory_id: "inv-1",
    borrower_id: "b-1",
    quantity: 1,
    loaned_at: "2026-06-01T00:00:00Z",
    due_date: "2026-07-01T00:00:00Z",
    is_active: true,
    is_overdue: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    item: { id: "it-1", name: "Drill" },
    borrower: { id: "b-1", name: "Alice" },
    ...over,
  };
}

function renderWithClient(ui: ReactElement) {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  registerMutationDefaults(client);
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>{ui}</ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("EditLoanDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("PATCHes the edited notes and closes", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch("/api/workspaces/:wsId/loans/:id", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeLoan({ notes: "be careful" }));
      }),
    );
    const onClose = vi.fn();

    renderWithClient(
      <EditLoanDialog open onClose={onClose} loan={makeLoan()} />,
    );

    await user.type(screen.getByLabelText(/notes/i), "be careful");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({ notes: "be careful" });
  });

  it("does not close the dialog when the save is rejected", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch("/api/workspaces/:wsId/loans/:id", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );
    const onClose = vi.fn();

    renderWithClient(
      <EditLoanDialog open onClose={onClose} loan={makeLoan()} />,
    );

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ExtendLoanDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("blocks Extend once the required due date is cleared", async () => {
    const user = userEvent.setup();
    const extended = vi.fn(() => HttpResponse.json(makeLoan()));
    server.use(http.patch("/api/workspaces/:wsId/loans/:id/extend", extended));

    renderWithClient(
      <ExtendLoanDialog open onClose={vi.fn()} loan={makeLoan()} />,
    );

    await user.clear(screen.getByLabelText(/new due date/i));

    expect(screen.getByRole("button", { name: /extend/i })).toBeDisabled();
    expect(extended).not.toHaveBeenCalled();
  });

  it("PATCHes the new due date and closes", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(
        "/api/workspaces/:wsId/loans/:id/extend",
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            makeLoan({ due_date: "2026-08-15T00:00:00Z" }),
          );
        },
      ),
    );
    const onClose = vi.fn();

    renderWithClient(
      <ExtendLoanDialog open onClose={onClose} loan={makeLoan()} />,
    );

    await user.click(screen.getByRole("button", { name: /extend/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toHaveProperty("new_due_date");
  });
});

describe("ReturnLoanDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("POSTs the return and closes", async () => {
    const user = userEvent.setup();
    const returned = vi.fn(() =>
      HttpResponse.json(makeLoan({ is_active: false })),
    );
    server.use(http.post("/api/workspaces/:wsId/loans/:id/return", returned));
    const onClose = vi.fn();

    renderWithClient(
      <ReturnLoanDialog open onClose={onClose} loan={makeLoan()} />,
    );

    await user.click(screen.getByRole("button", { name: /^return$/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(returned).toHaveBeenCalled();
  });

  it("does not close the dialog when the return is rejected", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/workspaces/:wsId/loans/:id/return", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );
    const onClose = vi.fn();

    renderWithClient(
      <ReturnLoanDialog open onClose={onClose} loan={makeLoan()} />,
    );

    await user.click(screen.getByRole("button", { name: /^return$/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^return$/i })).toBeEnabled(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
