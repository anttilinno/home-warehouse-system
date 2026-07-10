import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import type { Repair } from "@/lib/types";
import { CompleteRepairDialog } from "./CompleteRepairDialog";

// Phase 4 Plan 4.4 (test-gap PLAN-test-gaps.md) — CompleteRepairDialog.
// Submit + validation-error path only. "New condition" is optional (default
// keeps the current condition — no client zod), so "validation-error" here is
// a rejected mutation not closing the dialog (useRepairMutations onError
// never calls onClose — no false-positive close on a 4xx).

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

function makeRepair(over: Partial<Repair> = {}): Repair {
  return {
    id: "rep-1",
    workspace_id: "ws-1",
    inventory_id: "inv-1",
    status: "IN_PROGRESS",
    description: "Fix hinge",
    is_warranty_claim: false,
    ...over,
  };
}

function renderDialog(onClose: () => void) {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <CompleteRepairDialog open onClose={onClose} repair={makeRepair()} />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("CompleteRepairDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("POSTs the chosen new condition and closes", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(
        "/api/workspaces/:wsId/repairs/:id/complete",
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(makeRepair({ status: "COMPLETED" }));
        },
      ),
    );
    const onClose = vi.fn();

    renderDialog(onClose);

    await user.selectOptions(screen.getByLabelText(/new condition/i), "GOOD");
    await user.click(screen.getByRole("button", { name: /complete/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({ new_condition: "GOOD" });
  });

  it("does not close the dialog when the complete is rejected", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/workspaces/:wsId/repairs/:id/complete", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );
    const onClose = vi.fn();

    renderDialog(onClose);

    await user.click(screen.getByRole("button", { name: /complete/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /complete/i })).toBeEnabled(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
