/**
 * Loan test fixtures — re-exports taxonomy fixtures for shared utilities
 * (renderWithProviders, setupDialogMocks, TestAuthContext) and adds a
 * loan-specific entity factory with the 62-01 decoration embeds populated.
 */
import type { Loan, LoanEmbeddedItem, LoanEmbeddedBorrower } from "@/lib/api/loans";

export {
  TestAuthContext,
  renderWithProviders,
  setupDialogMocks,
} from "@/features/taxonomy/__tests__/fixtures";

export const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
export const NOW = "2026-04-17T12:00:00.000Z";

const DEFAULT_ITEM: LoanEmbeddedItem = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Cordless Drill",
  primary_photo_thumbnail_url: null,
};

const DEFAULT_BORROWER: LoanEmbeddedBorrower = {
  id: "44444444-4444-4444-4444-444444444444",
  name: "Alice Example",
};

/**
 * makeLoan — factory for Loan test fixtures with sensible defaults.
 *
 * Defaults describe an active, non-overdue quantity-1 loan to Alice of a
 * Cordless Drill. Override any field via the overrides object; the embedded
 * `item` and `borrower` objects are always populated to match the backend's
 * decorated response shape (62-01 SUMMARY §Next Phase Readiness).
 */
export function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "66666666-6666-6666-6666-666666666666",
    workspace_id: DEFAULT_WORKSPACE_ID,
    inventory_id: DEFAULT_ITEM.id,
    borrower_id: DEFAULT_BORROWER.id,
    quantity: 1,
    loaned_at: NOW,
    due_date: null,
    returned_at: null,
    notes: null,
    is_active: true,
    is_overdue: false,
    created_at: NOW,
    updated_at: NOW,
    item: DEFAULT_ITEM,
    borrower: DEFAULT_BORROWER,
    ...overrides,
  };
}
