// Stable mutationKeys for the offline-critical write hooks (Phase 3 prereq
// refactor — a persisted paused mutation resumes by key + registered
// defaults, never a closure). itemCreate (Phase 3a), containerCreate +
// locationCreate (Phase 3b) are all wired via mutationDefaults.ts.
export const MK = {
  itemCreate: ["items", "create"] as const,
  containerCreate: ["containers", "create"] as const,
  locationCreate: ["locations", "create"] as const,
  // C-quantity (OFFLINE-PWA-V2-PLAN.md): the offline "recount stock" write.
  // Unlike the creates it carries NO Idempotency-Key — updateQuantity is an
  // absolute-set PATCH (`{quantity:N}`), so replaying it is naturally
  // idempotent (set to N twice = N).
  inventoryQuantity: ["inventory", "quantity"] as const,
  // C-create: offline creation of an inventory (stock) entry. Dedupes on an
  // Idempotency-Key (POST creates a row — not naturally idempotent, unlike the
  // absolute-set quantity PATCH above).
  inventoryCreate: ["inventory", "create"] as const,
  // /capture: create an entity AND upload its photo as ONE queued unit. It
  // cannot be two mutations — the photo upload needs the id the server only
  // assigns when the create actually runs, and there is no temp-id remapping
  // in this codebase. Chaining them in a single mutationFn sidesteps that
  // entirely: on reconnect the create resolves first, in the same function.
  captureCreate: ["capture", "create"] as const,
};
