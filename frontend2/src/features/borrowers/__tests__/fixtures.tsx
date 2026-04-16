/**
 * Borrower test fixtures — re-exports taxonomy fixtures for shared utilities
 * (renderWithProviders, setupDialogMocks, TestAuthContext) and adds a
 * borrower-specific entity factory.
 */
import type { Borrower } from "@/lib/api/borrowers";

export {
  TestAuthContext,
  renderWithProviders,
  setupDialogMocks,
} from "@/features/taxonomy/__tests__/fixtures";

const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
const NOW = "2026-04-16T00:00:00Z";

export function makeBorrower(overrides: Partial<Borrower> = {}): Borrower {
  return {
    id: overrides.id ?? "44444444-4444-4444-4444-444444444444",
    workspace_id: overrides.workspace_id ?? DEFAULT_WORKSPACE_ID,
    name: overrides.name ?? "Alice Example",
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    notes: overrides.notes ?? null,
    is_archived: overrides.is_archived ?? false,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    ...overrides,
  };
}
