/**
 * Scan feature test fixtures — re-exports shared provider helpers from the
 * taxonomy fixtures module and adds a `makeScanHistoryEntry` factory so every
 * scan-feature test can import from a single local path.
 *
 * Plan 65-07: ScanPage now calls `useNavigate()` (for LOOK-02 navigation from
 * the banner's CREATE / VIEW buttons). We wrap the taxonomy
 * `renderWithProviders` with a `MemoryRouter` here so scan-feature tests
 * don't need to add a Router themselves, and unrelated features don't
 * inherit a router they never use.
 *
 * Pattern mirror: frontend2/src/features/items/__tests__/fixtures.ts
 */
import { createElement, type ReactElement } from "react";
import { MemoryRouter } from "react-router";
import {
  renderWithProviders as baseRenderWithProviders,
  type RenderWithProvidersOptions,
} from "@/features/taxonomy/__tests__/fixtures";
import type { ScanHistoryEntry } from "@/lib/scanner";

export {
  TestAuthContext,
  setupDialogMocks,
} from "@/features/taxonomy/__tests__/fixtures";

export interface RenderScanOptions extends RenderWithProvidersOptions {
  initialEntries?: string[];
}

/**
 * Scan-local renderWithProviders — layers a MemoryRouter OUTSIDE the shared
 * taxonomy providers so components that call `useNavigate` / `useLocation`
 * (e.g. ScanPage in Plan 65-07) have a router context. Defaults to a single
 * history entry at "/scan".
 *
 * Uses `createElement` instead of JSX so this file can stay `.ts` — the
 * scan-feature tests import from "./fixtures" (no extension) and the TS
 * resolver will pick up `.ts` without any test-file edits.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderScanOptions = {},
) {
  const { initialEntries = ["/scan"], ...rest } = options;
  const wrapped = createElement(MemoryRouter, { initialEntries }, ui);
  return baseRenderWithProviders(wrapped, rest);
}

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
