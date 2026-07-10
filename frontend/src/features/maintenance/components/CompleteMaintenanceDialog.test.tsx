import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import type { MaintenanceSchedule } from "@/lib/types";
import { CompleteMaintenanceDialog } from "./CompleteMaintenanceDialog";

// Phase 4 Plan 4.4 (test-gap PLAN-test-gaps.md) — CompleteMaintenanceDialog.
// Submit + validation-error path only. This is a one-tap RetroConfirmDialog
// with no inputs (R16 — no notes), so "validation-error" is a rejected
// mutation not closing the dialog (useMaintenanceMutations onError never
// calls onClose — no false-positive close/onCompleted on a 4xx).

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

function makeSchedule(
  over: Partial<MaintenanceSchedule> = {},
): MaintenanceSchedule {
  return {
    id: "sched-1",
    title: "Oil change",
    interval_days: 180,
    next_due: "2026-07-01",
    ...over,
  };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("CompleteMaintenanceDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  function renderDialog(props: {
    onClose?: () => void;
    onCompleted?: () => void;
  }) {
    setWsId("ws-1");
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ModalStackProvider>
            <CompleteMaintenanceDialog
              open
              onClose={props.onClose ?? vi.fn()}
              onCompleted={props.onCompleted}
              schedule={makeSchedule()}
            />
          </ModalStackProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );
  }

  it("POSTs complete and closes", async () => {
    const user = userEvent.setup();
    const completed = vi.fn(() =>
      HttpResponse.json(makeSchedule({ next_due: "2027-01-01" })),
    );
    server.use(
      http.post("/api/workspaces/:wsId/maintenance/:id/complete", completed),
    );
    const onClose = vi.fn();
    const onCompleted = vi.fn();

    renderDialog({ onClose, onCompleted });

    await user.click(screen.getByRole("button", { name: /complete/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCompleted).toHaveBeenCalled();
    expect(completed).toHaveBeenCalled();
  });

  it("does not close the dialog when the complete is rejected", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/workspaces/:wsId/maintenance/:id/complete", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );
    const onClose = vi.fn();
    const onCompleted = vi.fn();

    renderDialog({ onClose, onCompleted });

    await user.click(screen.getByRole("button", { name: /complete/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /complete/i })).toBeEnabled(),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
