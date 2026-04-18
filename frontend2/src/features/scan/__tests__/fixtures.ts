/**
 * Scan feature test fixtures — re-exports shared provider helpers from the
 * taxonomy fixtures module and adds a `makeScanHistoryEntry` factory so every
 * scan-feature test can import from a single local path.
 *
 * Pattern mirror: frontend2/src/features/items/__tests__/fixtures.ts
 */
import type { ScanHistoryEntry } from "@/lib/scanner";

export {
  TestAuthContext,
  renderWithProviders,
  setupDialogMocks,
} from "@/features/taxonomy/__tests__/fixtures";

export const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
export const NOW = Date.parse("2026-04-18T12:00:00.000Z");

/**
 * makeScanHistoryEntry — factory for ScanHistoryEntry fixtures with sensible
 * defaults. Override any field via the overrides object.
 */
export function makeScanHistoryEntry(
  overrides: Partial<ScanHistoryEntry> = {},
): ScanHistoryEntry {
  return {
    code: overrides.code ?? "TEST-CODE-123",
    format: overrides.format ?? "qr_code",
    entityType: overrides.entityType ?? "unknown",
    timestamp: overrides.timestamp ?? NOW,
    ...overrides,
  };
}
