import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { pendingChangesApi } from "./pendingChanges";

// SYS-01 — pendingChangesApi widened for the /approvals table (Phase 14 Plan 01).
// The list endpoint is owner/admin-only and returns the BARE { changes, total }
// envelope (key `changes`, NOT `items` — verified pendingchange/handler.go:381).
// approve/reject POST per-id; reject carries a { reason } body (minLength 1
// server-side). There is NO defer endpoint.

afterEach(() => server.resetHandlers());

describe("pendingChangesApi", () => {
  it("list(ws, {status:'pending'}) hits the status-narrowed path and returns the bare {changes,total} envelope", async () => {
    let capturedUrl = "";
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          changes: [
            {
              id: "pc-1",
              workspace_id: "ws-1",
              requester_id: "u-1",
              requester_name: "Alex",
              requester_email: "alex@test.local",
              entity_type: "item",
              entity_id: "item-9",
              action: "update",
              status: "pending",
              created_at: "2026-06-13T10:00:00Z",
            },
          ],
          total: 1,
        });
      }),
    );

    const res = await pendingChangesApi.list("ws-1", { status: "pending" });

    expect(capturedUrl).toContain("/workspaces/ws-1/pending-changes");
    expect(capturedUrl).toContain("status=pending");
    // The envelope key is `changes` (the row array), NOT `items`.
    expect(Array.isArray(res.changes)).toBe(true);
    expect(res.changes[0].requester_name).toBe("Alex");
    expect(res.changes[0].entity_type).toBe("item");
    expect(res.total).toBe(1);
    // The shape exposes no `items` key (would signal a wrong envelope).
    expect((res as unknown as { items?: unknown }).items).toBeUndefined();
  });

  it("approve(ws, id) POSTs /workspaces/{ws}/pending-changes/{id}/approve", async () => {
    let method = "";
    let url = "";
    server.use(
      http.post(
        "/api/workspaces/:ws/pending-changes/:id/approve",
        ({ request, params }) => {
          method = request.method;
          url = request.url;
          return HttpResponse.json({
            id: String(params.id),
            status: "approved",
          });
        },
      ),
    );

    await pendingChangesApi.approve("ws-1", "pc-1");

    expect(method).toBe("POST");
    expect(url).toContain("/workspaces/ws-1/pending-changes/pc-1/approve");
  });

  it("reject(ws, id, reason) POSTs /reject with the reason riding the body", async () => {
    let url = "";
    let body: unknown = null;
    server.use(
      http.post(
        "/api/workspaces/:ws/pending-changes/:id/reject",
        async ({ request, params }) => {
          url = request.url;
          body = await request.json();
          return HttpResponse.json({
            id: String(params.id),
            status: "rejected",
          });
        },
      ),
    );

    await pendingChangesApi.reject("ws-1", "pc-1", "dup");

    expect(url).toContain("/workspaces/ws-1/pending-changes/pc-1/reject");
    expect(body).toEqual({ reason: "dup" });
  });
});
