import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { inventoryApi } from "@/lib/api/inventory";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { MK } from "@/lib/offline/mutationKeys";
import { newIdemKey } from "@/lib/offline/idempotency";
import { isOfflineTempId } from "@/lib/offline/tempId";
import type { InventoryCreateVars } from "@/lib/offline/mutationDefaults";
import type { Condition, Inventory, InventoryStatus } from "@/lib/types";
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

  // Offline-capable (C-create): mutationFn + onSettled invalidate live in the
  // registered default (mutationDefaults.ts) so a paused create survives a
  // reload and replays with no hook mounted. The hook supplies the optimistic
  // list insert + revert-on-error for the online/hook-mounted path.
  interface CreateContext {
    snapshots: [QueryKey, unknown][];
  }
  type InventoryListLike = { items: Inventory[]; total?: number } & Record<
    string,
    unknown
  >;

  const create = useMutation<
    Inventory,
    Error,
    InventoryCreateVars,
    CreateContext
  >({
    mutationKey: MK.inventoryCreate,
    onMutate: async (vars) => {
      const prefix: QueryKey = ["inventory", vars.wsId];
      await queryClient.cancelQueries({ queryKey: prefix });
      const snapshots = queryClient.getQueriesData({ queryKey: prefix });
      const now = new Date().toISOString();
      const b = vars.body;
      const tempEntry: Inventory = {
        id: crypto.randomUUID(),
        workspace_id: vars.wsId,
        item_id: b.item_id as string,
        location_id: b.location_id as string,
        container_id: b.container_id as string | undefined,
        quantity: (b.quantity as number | undefined) ?? 0,
        condition: b.condition as Condition,
        status: b.status as InventoryStatus,
        date_acquired: b.date_acquired as string | undefined,
        warranty_expires: b.warranty_expires as string | undefined,
        expiration_date: b.expiration_date as string | undefined,
        notes: b.notes as string | undefined,
        is_archived: false,
        created_at: now,
        updated_at: now,
      };
      queryClient.setQueriesData<InventoryListLike>(
        { queryKey: prefix },
        (old) => {
          if (!old || !Array.isArray(old.items)) return old;
          return {
            ...old,
            items: [tempEntry, ...old.items],
            total: (old.total ?? old.items.length) + 1,
          };
        },
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      retroToast.error(t`Couldn't save this entry.`);
    },
    // onSettled (the real invalidate) lives in mutationDefaults.ts so a resumed
    // replay refetches even with no hook mounted. This onSuccess is cosmetic.
    onSuccess: () => retroToast.success(t`Entry saved.`),
  });

  // Wraps create.mutateAsync so callers keep passing bare InventoryFormValues —
  // wsId + the idempotency key are minted here.
  function createEntry(values: InventoryFormValues): Promise<Inventory> {
    // Dependent-write guard (option a): a stock entry against an item created
    // offline carries a temp item_id with no server row, so it can never sync —
    // the backend would 404. Block it at the single write chokepoint rather than
    // at each caller (ADD button / ?item= prefill / direct URL all land here).
    if (isOfflineTempId(values.item_id)) {
      // ponytail: nearly-never-seen defensive toast, en-only — no i18n extract.
      retroToast.error("Finish syncing this item before adding stock to it.");
      return Promise.reject(new Error("dependent write against unsynced item"));
    }
    return create.mutateAsync({
      wsId: wsId as string,
      idemKey: newIdemKey(),
      body: buildCreateBody(values),
    });
  }

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

  return { create, createEntry, update };
}
