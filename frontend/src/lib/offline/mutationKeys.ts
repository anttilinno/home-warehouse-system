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
};
