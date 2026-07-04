import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { itemsApi } from "@/lib/api/items";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { MK } from "@/lib/offline/mutationKeys";
import { newIdemKey } from "@/lib/offline/idempotency";
import { generateShortCode } from "@/lib/offline/shortCode";
import { newOfflineTempId } from "@/lib/offline/tempId";
import type { ItemCreateVars } from "@/lib/offline/mutationDefaults";
import type { Item, ItemListResponse } from "@/lib/types";
import type { ItemFormValues } from "../schema";

// Phase 7 Plan 05 — create/edit mutations for the item form.
//
// createMutation (Phase 3a offline rewrite): mutationFn lives in the
// centrally-registered default (mutationDefaults.ts) so a paused offline
// create survives a page reload — the hook only supplies mutationKey +
// optimistic onMutate/onError/onSuccess (re-registered on mount; not needed
// for a resumed replay, see mutationDefaults.ts doc comment). Callers keep
// calling `createItem(values)` (wraps `create.mutateAsync` with the
// wsId/idemKey/short_code variables); `create` itself is exposed for
// isPending/isError.
//
// updateMutation → itemsApi.update then invalidate BOTH the ["items", wsId]
// prefix AND the explicit detail key ["items", wsId, "detail", id] so a stale
// detail cache can never survive an edit (the prefix already covers it; the
// explicit key is belt-and-suspenders + documents the contract).
//
// PATCH clear-semantics (Pitfall 4, threat T-07-15): the edit body is built from
// RHF's `dirtyFields` map ONLY. A dirty *string* field that the user cleared is
// sent as "" (clear); an untouched field is OMITTED (unchanged) — NEVER sent as
// "" by accident, so an edit can never silently null a field the user never
// touched. uuid fields (category_id) have no "" clear path on the backend and
// are never emitted here.

/** Which top-level form keys are dirty (RHF formState.dirtyFields, flattened). */
export type DirtyMap = Partial<Record<keyof ItemFormValues, boolean>>;

// Map the form's resolved values to the backend create body. Only fields the
// backend item entity actually owns are sent: sku, name, description, barcode,
// min_stock_level. `sku` is REQUIRED by the backend createItemInput
// (minLength:1) — omitting it returned 422 (D-07-07-A); zod guarantees a
// non-empty trimmed string here. category/location are display-only (no uuid
// resolution yet — documented stub) and are NOT submitted. Empty optional
// strings are omitted on CREATE (a brand-new item has no field to "clear").
function buildCreateBody(values: ItemFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    sku: values.sku,
    name: values.name,
  };
  if (values.description) body.description = values.description;
  if (values.barcode) body.barcode = values.barcode;
  if (values.minStock !== undefined) body.min_stock_level = values.minStock;
  return body;
}

// Build the PATCH body from the dirty fields only (Pitfall 4).
// - string field (description/barcode): dirty → send its value, even "" (clear).
// - minStock (min_stock_level, *int): dirty → send the number; cleared (undefined)
//   is NOT sent (an int has no "" clear path — omit = unchanged).
// - name: dirty → send (always a non-empty string; zod guarantees min 1).
// - sku: NEVER sent — SKU is immutable after create (the backend
//   UpdateItemInput has no `sku` field), so it is read-only in edit mode and
//   omitted here regardless of dirty state.
// - category/location: never sent (display-only stub; category_id is a uuid).
export function buildPatchBody(
  values: ItemFormValues,
  dirty: DirtyMap,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (dirty.name) patch.name = values.name;
  // *string fields: send the value verbatim when dirty — "" is an intentional clear.
  if (dirty.description) patch.description = values.description ?? "";
  if (dirty.barcode) patch.barcode = values.barcode ?? "";
  // *int: only send when dirty AND a real number remains (no "" clear path).
  if (dirty.minStock && values.minStock !== undefined) {
    patch.min_stock_level = values.minStock;
  }
  return patch;
}

export function useItemFormMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const { t } = useLingui();

  function invalidatePrefix() {
    // Prefix-match (default exact:false) — covers list + detail (Phase 6).
    queryClient.invalidateQueries({ queryKey: ["items", wsId as string] });
  }

  // Snapshot every ["items", wsId] cache entry so onError can restore it
  // (mirrors useLoanMutations' optimisticPatch/restore pattern).
  interface CreateContext {
    snapshots: [QueryKey, unknown][];
  }

  const create = useMutation<Item, Error, ItemCreateVars, CreateContext>({
    mutationKey: MK.itemCreate,
    // No mutationFn here — resolved from the mutationDefaults.ts registration
    // so a resumed-after-reload replay still has a request to run.
    onMutate: async (vars) => {
      const prefix: QueryKey = ["items", vars.wsId];
      await queryClient.cancelQueries({ queryKey: prefix });
      const snapshots = queryClient.getQueriesData({ queryKey: prefix });
      const now = new Date().toISOString();
      const tempItem: Item = {
        // Tagged temp id: marks this row as not-yet-synced so dependent writes
        // (a stock entry against it) can be blocked. Never sent to the backend.
        id: newOfflineTempId(),
        workspace_id: vars.wsId,
        sku: (vars.body.sku as string | undefined) ?? "",
        name: (vars.body.name as string | undefined) ?? "",
        description: vars.body.description as string | undefined,
        barcode: vars.body.barcode as string | undefined,
        min_stock_level: (vars.body.min_stock_level as number | undefined) ?? 0,
        short_code: vars.body.short_code as string,
        created_at: now,
        updated_at: now,
      };
      // ponytail: patches every cached ["items", wsId, params] list regardless
      // of its own filter/sort/page, so the temp row can appear on a
      // page/search it wouldn't actually match once real. Acceptable for v1 —
      // the reconnect invalidate (mutationDefaults onSettled) replaces it with
      // the real, correctly-filtered set.
      queryClient.setQueriesData<ItemListResponse>(
        { queryKey: prefix },
        (old) => {
          if (!old || !Array.isArray(old.items)) return old;
          return {
            ...old,
            items: [tempItem, ...old.items],
            total: old.total + 1,
          };
        },
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      retroToast.error(t`Couldn't save this item.`);
    },
    // onSettled (the real invalidate) lives in mutationDefaults.ts so a
    // resumed replay (no hook mounted) still refetches. This onSuccess is
    // cosmetic-only — it fires when the hook happens to be mounted at resolve
    // time.
    onSuccess: () => retroToast.success(t`Item saved.`),
  });

  // Wraps `create.mutateAsync` so callers keep passing bare ItemFormValues —
  // wsId, the idempotency key, and the client-generated short_code (final at
  // creation, printed on the label — never remapped) are minted here.
  function createItem(values: ItemFormValues): Promise<Item> {
    return create.mutateAsync({
      wsId: wsId as string,
      idemKey: newIdemKey(),
      body: { ...buildCreateBody(values), short_code: generateShortCode() },
    });
  }

  const update = useMutation({
    mutationFn: ({
      id,
      values,
      dirty,
    }: {
      id: string;
      values: ItemFormValues;
      dirty: DirtyMap;
    }): Promise<Item> =>
      itemsApi.update(wsId as string, id, buildPatchBody(values, dirty)),
    onSuccess: (_data, { id }) => {
      invalidatePrefix();
      // Belt-and-suspenders: also nuke the explicit detail key (the prefix above
      // already covers it, but the contract names this key — keep it explicit).
      queryClient.invalidateQueries({
        queryKey: ["items", wsId as string, "detail", id],
      });
      retroToast.success(t`Item saved.`);
    },
    onError: () => retroToast.error(t`Couldn't save this item.`),
  });

  return { create, createItem, update };
}
