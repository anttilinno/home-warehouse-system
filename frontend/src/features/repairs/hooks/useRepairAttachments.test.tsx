import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { repairHandlers } from "@/test/msw/repairHandlers";
import { useRepairAttachments } from "./useRepairAttachments";

// Phase 10b Plan 03 Task 2 (TDD) — repair attachment reads + link/delete writes.
// The list query is keyed ["repairs", wsId, repairId, "attachments"]; create links
// an existing file_id; delete removes a row. Both invalidate the attachments key.

const WS = "ws-1";
const REPAIR = "repair-completed";
const ATT_KEY = ["repairs", WS, REPAIR, "attachments"];

function makeHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { client, wrapper };
}

afterEach(() => vi.clearAllMocks());

describe("useRepairAttachments", () => {
  it("lists attachments keyed [repairs,wsId,repairId,attachments]", async () => {
    server.use(...repairHandlers);
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useRepairAttachments(WS, REPAIR), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0].file_name).toBe("receipt.pdf");
  });

  it("createAttachment links a file_id and invalidates the attachments key", async () => {
    server.use(...repairHandlers);
    let body: unknown;
    server.use(
      http.post(
        "/api/workspaces/:wsId/repairs/:id/attachments",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            id: "ratt-new",
            repair_log_id: REPAIR,
            file_id: "file-9",
            attachment_type: "MANUAL",
            title: "Manual",
          });
        },
      ),
    );
    const { client, wrapper } = makeHarness();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRepairAttachments(WS, REPAIR), {
      wrapper,
    });

    await act(async () => {
      await result.current.createAttachment.mutateAsync({
        file_id: "file-9",
        attachment_type: "MANUAL",
        title: "Manual",
      });
    });

    expect(body).toEqual({
      file_id: "file-9",
      attachment_type: "MANUAL",
      title: "Manual",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ATT_KEY });
  });

  it("deleteAttachment removes a row and invalidates", async () => {
    server.use(...repairHandlers);
    let deleted = "";
    server.use(
      http.delete(
        "/api/workspaces/:wsId/repairs/:id/attachments/:attId",
        ({ params }) => {
          deleted = String(params.attId);
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );
    const { client, wrapper } = makeHarness();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRepairAttachments(WS, REPAIR), {
      wrapper,
    });

    await act(async () => {
      await result.current.deleteAttachment.mutateAsync("ratt-1");
    });

    expect(deleted).toBe("ratt-1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ATT_KEY });
  });
});
