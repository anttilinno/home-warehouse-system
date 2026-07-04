import type { QueryClient } from "@tanstack/react-query";
import { msg } from "@lingui/core/macro";
import { queryClient } from "@/lib/queryClient";
import { i18n } from "@/lib/i18n";
import { retroToast } from "@/components/retro";
import { itemsApi } from "@/lib/api/items";
import {
  containerApi,
  type Container,
  type CreateContainerBody,
} from "@/lib/api/container";
import {
  locationApi,
  type Location,
  type CreateLocationBody,
} from "@/lib/api/location";
import { inventoryApi } from "@/lib/api/inventory";
import type { Inventory, Item } from "@/lib/types";
import { MK } from "./mutationKeys";

// Registered once at boot (App.tsx module scope). A resumed paused mutation
// (page reload → drain) runs ONLY these defaults, never the hook's
// onMutate/onError/onSuccess — so everything a replay needs (the request
// itself, FIFO ordering, the post-drain refetch) must live here. Optimistic
// cache patching stays in the hook (Prerequisite refactor, plan §"Prerequisite
// refactor"): the patched cache state was already persisted, so it survives
// reload without the hook re-running onMutate.
export interface ItemCreateVars {
  wsId: string;
  idemKey: string;
  body: Record<string, unknown>;
}

// Phase 3b — same shape as ItemCreateVars, body typed to the entity's create
// contract since containerApi/locationApi.create keep a strict body type
// (unlike itemsApi.create's loose Record<string, unknown>).
export interface ContainerCreateVars {
  wsId: string;
  idemKey: string;
  body: CreateContainerBody;
}

export interface LocationCreateVars {
  wsId: string;
  idemKey: string;
  body: CreateLocationBody;
}

// C-quantity — offline "recount stock" adjust. wsId travels in the vars (not a
// hook closure) so a hookless post-reload replay still has a target workspace.
// No idemKey: the PATCH is an absolute set, idempotent on replay.
export interface InventoryQuantityVars {
  wsId: string;
  id: string;
  quantity: number;
}

// `client` defaults to the app singleton; tests pass their own QueryClient
// instance so a locally-mounted hook still has a mutationFn to resolve.
export function registerMutationDefaults(
  client: QueryClient = queryClient,
): void {
  client.setMutationDefaults(MK.itemCreate, {
    mutationFn: (vars: ItemCreateVars): Promise<Item> =>
      itemsApi.create(vars.wsId, vars.body, {
        "Idempotency-Key": vars.idemKey,
      }),
    // Serial FIFO across every offline-queued write (resumePausedMutations
    // otherwise fires paused mutations concurrently).
    scope: { id: "offline-writes" },
    // Surfaces a replay failure (e.g. a 4xx on drain after reload) — the
    // hook's onError never mounts on a resumed paused mutation, so without
    // this the optimistic row just silently vanishes on the onSettled
    // invalidate below (A3).
    onError: (_err, vars) => {
      const name = (vars.body?.name as string | undefined) ?? "item";
      retroToast.error(
        i18n._(msg`Couldn't sync "${name}" — it may have been removed.`),
      );
    },
    // Prefix-invalidate scoped to the authoring workspace (from variables, not
    // a hook closure — this also fires on a resume with no hook mounted) so
    // the temp optimistic row is replaced by the real server row.
    onSettled: (_data, _err, vars) =>
      client.invalidateQueries({ queryKey: ["items", vars.wsId] }),
  });

  client.setMutationDefaults(MK.containerCreate, {
    mutationFn: (vars: ContainerCreateVars): Promise<Container> =>
      containerApi.create(vars.wsId, vars.body, {
        "Idempotency-Key": vars.idemKey,
      }),
    scope: { id: "offline-writes" },
    onError: (_err, vars) => {
      retroToast.error(
        i18n._(
          msg`Couldn't sync "${vars.body.name}" — it may have been removed.`,
        ),
      );
    },
    onSettled: (_data, _err, vars) =>
      client.invalidateQueries({ queryKey: ["containers", vars.wsId] }),
  });

  client.setMutationDefaults(MK.locationCreate, {
    mutationFn: (vars: LocationCreateVars): Promise<Location> =>
      locationApi.create(vars.wsId, vars.body, {
        "Idempotency-Key": vars.idemKey,
      }),
    scope: { id: "offline-writes" },
    onError: (_err, vars) => {
      retroToast.error(
        i18n._(
          msg`Couldn't sync "${vars.body.name}" — it may have been removed.`,
        ),
      );
    },
    onSettled: (_data, _err, vars) =>
      client.invalidateQueries({ queryKey: ["locations", vars.wsId] }),
  });

  client.setMutationDefaults(MK.inventoryQuantity, {
    mutationFn: (vars: InventoryQuantityVars): Promise<Inventory> =>
      inventoryApi.updateQuantity(vars.wsId, vars.id, vars.quantity),
    // Same serial FIFO scope as the creates: a recount enqueued after an
    // offline create drains after it.
    scope: { id: "offline-writes" },
    // Replay-failure toast (A3 parity): the hook's onError never mounts on a
    // resumed paused mutation. No client rollback here — the onSettled
    // invalidate below refetches the server-authoritative quantity, correcting
    // the persisted optimistic patch.
    onError: () =>
      retroToast.error(i18n._(msg`Couldn't sync a stock recount.`)),
    onSettled: (_data, _err, vars) =>
      client.invalidateQueries({ queryKey: ["inventory", vars.wsId] }),
  });
}
