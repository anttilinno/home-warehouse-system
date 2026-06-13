import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { inventoryApi } from "@/lib/api/inventory";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Inventory } from "@/lib/types";
import type { InventoryFormValues } from "../schema";

// Phase 7b Plan 03 — create/edit mutations for the inventory entry form.
//
// create → inventoryApi.create then invalidate the ["inventory", wsId] PREFIX
// (no exact:true — covers list + every detail key, matching the item-form
// contract). The create body INCLUDES status (the backend createInventoryInput
// requires it).
//
// update → inventoryApi.update (full PATCH) then invalidate BOTH the prefix AND
// the explicit detail key. The PATCH body NEVER carries status (Pitfall 6 —
// status is exclusively the dedicated /status route) and always bundles
// location_id + quantity + condition when any PATCH-owned field is dirty (the
// backend full PATCH requires the whole bundle — 07b-RESEARCH Pattern 2).
//
// Dates: a non-empty YYYY-MM-DD value is serialized to RFC3339 by appending
// `T00:00:00Z` (the backend binds *time.Time). An empty/absent date is OMITTED
// (never zero-injected — Pitfall 4/7).

/** Which top-level form keys are dirty (RHF formState.dirtyFields, flattened). */
export type DirtyMap = Partial<Record<keyof InventoryFormValues, boolean>>;

// Serialize a YYYY-MM-DD date to RFC3339; "" / undefined → undefined (omit).
function toRfc3339(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return `${date}T00:00:00Z`;
}

// CREATE body — includes status + serializes set dates; omits empty optionals.
export function buildCreateBody(
  values: InventoryFormValues,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    item_id: values.item_id,
    location_id: values.location_id,
    quantity: values.quantity,
    condition: values.condition,
    status: values.status,
  };
  if (values.container_id) body.container_id = values.container_id;
  const acquired = toRfc3339(values.date_acquired);
  if (acquired) body.date_acquired = acquired;
  const warranty = toRfc3339(values.warranty_expires);
  if (warranty) body.warranty_expires = warranty;
  const expiry = toRfc3339(values.expiration_date);
  if (expiry) body.expiration_date = expiry;
  if (values.notes) body.notes = values.notes;
  return body;
}

// PATCH body — full PATCH, NEVER status (Pitfall 6).
// - location_id / quantity / condition form a required bundle: if ANY of them
//   is dirty, all three are sent (the backend full PATCH validates the bundle).
// - container_id: dirty → send the value, even "" (clear to "no container").
// - dates: dirty → serialize to RFC3339; a dirty cleared date sends "" (clear).
// - notes: dirty → send the value, even "" (clear).
// - status: NEVER sent — it rides the dedicated /status route only.
export function buildPatchBody(
  values: InventoryFormValues,
  dirty: DirtyMap,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const bundleDirty = dirty.location_id || dirty.quantity || dirty.condition;
  if (bundleDirty) {
    patch.location_id = values.location_id;
    patch.quantity = values.quantity;
    patch.condition = values.condition;
  }

  if (dirty.container_id) patch.container_id = values.container_id ?? "";

  if (dirty.date_acquired) {
    patch.date_acquired = toRfc3339(values.date_acquired) ?? "";
  }
  if (dirty.warranty_expires) {
    patch.warranty_expires = toRfc3339(values.warranty_expires) ?? "";
  }
  if (dirty.expiration_date) {
    patch.expiration_date = toRfc3339(values.expiration_date) ?? "";
  }

  if (dirty.notes) patch.notes = values.notes ?? "";

  return patch;
}

export function useInventoryFormMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();
  const { t } = useLingui();

  function invalidatePrefix() {
    // Prefix-match (default exact:false) — covers list + detail.
    queryClient.invalidateQueries({ queryKey: ["inventory", wsId as string] });
  }

  const create = useMutation({
    mutationFn: (values: InventoryFormValues): Promise<Inventory> =>
      inventoryApi.create(wsId as string, buildCreateBody(values)),
    onSuccess: () => {
      invalidatePrefix();
      retroToast.success(t`Entry saved.`);
    },
    onError: () => retroToast.error(t`Couldn't save this entry.`),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      values,
      dirty,
    }: {
      id: string;
      values: InventoryFormValues;
      dirty: DirtyMap;
    }): Promise<Inventory> =>
      inventoryApi.update(wsId as string, id, buildPatchBody(values, dirty)),
    onSuccess: (_data, { id }) => {
      invalidatePrefix();
      // Belt-and-suspenders: the prefix already covers it, but the contract
      // names the explicit detail key — keep it explicit.
      queryClient.invalidateQueries({
        queryKey: ["inventory", wsId as string, "detail", id],
      });
      retroToast.success(t`Entry saved.`);
    },
    onError: () => retroToast.error(t`Couldn't save this entry.`),
  });

  return { create, update };
}
