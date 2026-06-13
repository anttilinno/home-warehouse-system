import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { itemFormSchema, type ItemFormValues } from "../schema";
import {
  useItemFormMutations,
  buildPatchBody,
  type DirtyMap,
} from "./useItemFormMutations";

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

// Resolve raw form input through the schema so values match the shape the hook
// receives at submit time (minStock coerced from string → number|undefined).
function resolve(raw: Record<string, unknown>): ItemFormValues {
  return itemFormSchema.parse(raw);
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("itemFormSchema", () => {
  it("rejects an empty name", () => {
    const result = itemFormSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts a minimal item and defaults optional strings to ''", () => {
    const values = resolve({ name: "Drill" });
    expect(values.name).toBe("Drill");
    expect(values.description).toBe("");
    expect(values.barcode).toBe("");
    expect(values.minStock).toBeUndefined();
  });

  it("coerces a numeric minStock string to a number and rejects negatives", () => {
    expect(resolve({ name: "X", minStock: "5" }).minStock).toBe(5);
    expect(itemFormSchema.safeParse({ name: "X", minStock: "-1" }).success).toBe(
      false,
    );
  });
});

describe("buildPatchBody (Pitfall 4 — omit=unchanged, ''=clear, uuid never cleared)", () => {
  it("sends '' for a cleared description but OMITS an untouched name", () => {
    const values = resolve({ name: "Drill", description: "", barcode: "X9" });
    // Only description + barcode are dirty; name was NOT touched.
    const dirty: DirtyMap = { description: true, barcode: true };
    const patch = buildPatchBody(values, dirty);
    expect(patch).toEqual({ description: "", barcode: "X9" });
    expect("name" in patch).toBe(false);
  });

  it("omits min_stock_level when minStock was cleared (no '' clear path for int)", () => {
    const values = resolve({ name: "Drill", minStock: "" });
    const dirty: DirtyMap = { minStock: true };
    const patch = buildPatchBody(values, dirty);
    expect("min_stock_level" in patch).toBe(false);
  });

  it("never emits category/location (display-only stub, uuid never cleared)", () => {
    const values = resolve({ name: "Drill", category: "Tools", location: "Garage" });
    const dirty: DirtyMap = { category: true, location: true, name: true };
    const patch = buildPatchBody(values, dirty);
    expect("category" in patch).toBe(false);
    expect("category_id" in patch).toBe(false);
    expect("location" in patch).toBe(false);
    expect(patch).toEqual({ name: "Drill" });
  });
});

describe("useItemFormMutations", () => {
  it("create invalidates the ['items', wsId] prefix", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useItemFormMutations(), { wrapper });
    await act(async () => {
      await result.current.create.mutateAsync(resolve({ name: "Drill" }));
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
    // No exact:true — prefix-match must cover list + detail.
    const call = spy.mock.calls.find(
      (c) => Array.isArray(c[0]?.queryKey) && c[0]!.queryKey.length === 2,
    );
    expect(call?.[0] && "exact" in call[0]).toBe(false);
  });

  it("edit sends the cleared-'' / omitted PATCH and invalidates prefix + detail key", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    let sentBody: unknown;
    server.use(
      http.patch(
        "/api/workspaces/:wsId/items/:id",
        async ({ request }) => {
          sentBody = await request.json();
          return HttpResponse.json({
            id: "it-1",
            workspace_id: "ws-A",
            sku: "SKU-1",
            name: "Drill",
            min_stock_level: 0,
            short_code: "abc",
            created_at: "2026-06-13T00:00:00Z",
            updated_at: "2026-06-13T00:00:00Z",
          });
        },
      ),
    );

    const values = resolve({ name: "Drill", description: "" });
    const dirty: DirtyMap = { description: true }; // cleared description; name untouched

    const { result } = renderHook(() => useItemFormMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({ id: "it-1", values, dirty });
    });

    // PATCH body: "" for the cleared description, name OMITTED (untouched).
    expect(sentBody).toEqual({ description: "" });

    // Invalidates BOTH the prefix and the explicit detail key.
    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ["items", "ws-A", "detail", "it-1"],
    });
  });

  it("surfaces a toast error when create fails", async () => {
    setWsId("ws-A");
    const { wrapper } = makeHarness();
    server.use(
      http.post("/api/workspaces/:wsId/items", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useItemFormMutations(), { wrapper });
    await act(async () => {
      await result.current.create
        .mutateAsync(resolve({ name: "Drill" }))
        .catch(() => undefined);
    });
    expect(result.current.create.isError).toBe(true);
  });
});
