import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { itemsApi } from "@/lib/api/items";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Item } from "@/lib/types";
import type { ItemFormValues } from "../schema";

// Phase 7 Plan 05 — create/edit mutations for the item form.
//
// createMutation → itemsApi.create then invalidate the ["items", wsId] PREFIX
// (no exact:true — prefix covers list + every detail key, per the SSE
// invalidation contract).
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
// backend item entity actually owns are sent: name, description, barcode,
// min_stock_level. category/location are display-only (no uuid resolution yet —
// documented stub) and are NOT submitted. Empty optional strings are omitted on
// CREATE (a brand-new item has no field to "clear").
function buildCreateBody(values: ItemFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = { name: values.name };
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

  const create = useMutation({
    mutationFn: (values: ItemFormValues): Promise<Item> =>
      itemsApi.create(wsId as string, buildCreateBody(values)),
    onSuccess: () => {
      invalidatePrefix();
      retroToast.success(t`Item saved.`);
    },
    onError: () => retroToast.error(t`Couldn't save this item.`),
  });

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

  return { create, update };
}
