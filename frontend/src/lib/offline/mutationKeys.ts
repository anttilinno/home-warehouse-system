// Stable mutationKeys for the offline-critical write hooks (Phase 3 prereq
// refactor — a persisted paused mutation resumes by key + registered
// defaults, never a closure). itemCreate (Phase 3a), containerCreate +
// locationCreate (Phase 3b) are all wired via mutationDefaults.ts.
export const MK = {
  itemCreate: ["items", "create"] as const,
  containerCreate: ["containers", "create"] as const,
  locationCreate: ["locations", "create"] as const,
};
