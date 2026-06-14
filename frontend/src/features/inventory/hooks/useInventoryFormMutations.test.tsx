import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { inventoryFormSchema, type InventoryFormValues } from "../schema";
import {
  useInventoryFormMutations,
  buildCreateBody,
  buildPatchBody,
  type DirtyMap,
} from "./useInventoryFormMutations";

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

// Resolve raw input through the schema so the body-builders receive the shape
// they get at submit time (quantity coerced to number).
function resolve(raw: Record<string, unknown> = {}): InventoryFormValues {
  return inventoryFormSchema.parse({
    item_id: "it-1",
    location_id: "loc-1",
    condition: "GOOD",
    status: "AVAILABLE",
    quantity: "2",
    ...raw,
  });
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("buildCreateBody", () => {
  it("includes status + required ids and serializes set dates to RFC3339", () => {
    const values = resolve({
      container_id: "cont-1",
      date_acquired: "2026-01-15",
      warranty_expires: "2027-01-15",
      expiration_date: "2028-01-15",
      notes: "from receipt",
    });
    const body = buildCreateBody(values);
    expect(body).toMatchObject({
      item_id: "it-1",
      location_id: "loc-1",
      container_id: "cont-1",
      quantity: 2,
      condition: "GOOD",
      status: "AVAILABLE",
      date_acquired: "2026-01-15T00:00:00Z",
      warranty_expires: "2027-01-15T00:00:00Z",
      expiration_date: "2028-01-15T00:00:00Z",
      notes: "from receipt",
    });
  });

  it("omits empty optional fields (no zero-injection)", () => {
    const body = buildCreateBody(resolve());
    expect("container_id" in body).toBe(false);
    expect("date_acquired" in body).toBe(false);
    expect("warranty_expires" in body).toBe(false);
    expect("expiration_date" in body).toBe(false);
    expect("notes" in body).toBe(false);
    // But the required fields incl. status are always present.
    expect(body).toMatchObject({
      item_id: "it-1",
      location_id: "loc-1",
      quantity: 2,
      condition: "GOOD",
      status: "AVAILABLE",
    });
  });
});

describe("buildPatchBody (full PATCH — never status, Pitfall 6)", () => {
  it("NEVER includes status even when dirty", () => {
    const values = resolve({ status: "IN_USE" });
    const dirty: DirtyMap = { status: true, condition: true };
    const patch = buildPatchBody(values, dirty);
    expect("status" in patch).toBe(false);
  });

  it("bundles location_id+quantity+condition when any PATCH-owned field is dirty", () => {
    const values = resolve({ quantity: "7", condition: "FAIR", location_id: "loc-9" });
    const patch = buildPatchBody(values, { quantity: true });
    // The full PATCH requires the whole bundle even if only one is dirty.
    expect(patch).toMatchObject({
      location_id: "loc-9",
      quantity: 7,
      condition: "FAIR",
    });
  });

  it("serializes a dirty date to RFC3339 and omits an untouched one", () => {
    const values = resolve({
      date_acquired: "2026-02-01",
      expiration_date: "2026-12-31",
    });
    const patch = buildPatchBody(values, { expiration_date: true });
    expect(patch.expiration_date).toBe("2026-12-31T00:00:00Z");
    expect("date_acquired" in patch).toBe(false);
  });

  it("emits container_id and notes only when dirty", () => {
    const values = resolve({ container_id: "cont-5", notes: "moved" });
    const patch = buildPatchBody(values, { notes: true });
    expect(patch.notes).toBe("moved");
    expect("container_id" in patch).toBe(false);
  });
});

describe("useInventoryFormMutations", () => {
  it("create POSTs a body with status + RFC3339 dates and invalidates the prefix", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    let sentBody: unknown;
    server.use(
      http.post("/api/workspaces/:wsId/inventory", async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({ id: "inv-1" });
      }),
    );
    const { result } = renderHook(() => useInventoryFormMutations(), { wrapper });
    await act(async () => {
      await result.current.create.mutateAsync(
        resolve({ date_acquired: "2026-01-15" }),
      );
    });
    expect(sentBody).toMatchObject({
      status: "AVAILABLE",
      date_acquired: "2026-01-15T00:00:00Z",
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["inventory", "ws-A"] });
  });

  it("update PATCHes a body WITHOUT status and invalidates the prefix + detail key", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    let sentBody: Record<string, unknown> = {};
    server.use(
      http.patch("/api/workspaces/:wsId/inventory/:id", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "inv-1" });
      }),
    );
    const values = resolve({ status: "IN_USE", quantity: "9" });
    const dirty: DirtyMap = { status: true, quantity: true };
    const { result } = renderHook(() => useInventoryFormMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({ id: "inv-1", values, dirty });
    });
    expect("status" in sentBody).toBe(false);
    expect(sentBody.quantity).toBe(9);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["inventory", "ws-A"] });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ["inventory", "ws-A", "detail", "inv-1"],
    });
  });

  it("surfaces an error when create fails", async () => {
    setWsId("ws-A");
    const { wrapper } = makeHarness();
    server.use(
      http.post("/api/workspaces/:wsId/inventory", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useInventoryFormMutations(), { wrapper });
    await act(async () => {
      await result.current.create.mutateAsync(resolve()).catch(() => undefined);
    });
    expect(result.current.create.isError).toBe(true);
  });
});
