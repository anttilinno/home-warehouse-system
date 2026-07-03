import type { QueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import type { Item } from "@/lib/types";
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
    onSettled: (_data, _err, vars) =>
      client.invalidateQueries({ queryKey: ["containers", vars.wsId] }),
  });

  client.setMutationDefaults(MK.locationCreate, {
    mutationFn: (vars: LocationCreateVars): Promise<Location> =>
      locationApi.create(vars.wsId, vars.body, {
        "Idempotency-Key": vars.idemKey,
      }),
    scope: { id: "offline-writes" },
    onSettled: (_data, _err, vars) =>
      client.invalidateQueries({ queryKey: ["locations", vars.wsId] }),
  });
}
