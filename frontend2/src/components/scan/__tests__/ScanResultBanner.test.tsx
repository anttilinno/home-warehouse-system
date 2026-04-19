import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

// Mock formatScanTime so timestamps render deterministically in tests.
vi.mock("@/lib/scanner", () => ({
  formatScanTime: vi.fn(() => "Just now"),
}));

import { ScanResultBanner } from "../ScanResultBanner";
import { formatScanTime } from "@/lib/scanner";
import type { Item } from "@/lib/api/items";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

// Phase 65 Plan 65-06: these 7 Phase 64 assertions are MIGRATED (not deleted)
// under the MATCH-state render path. The banner was widened in-place from a
// single "SCANNED" state to four states (LOADING/MATCH/NOT-FOUND/ERROR per
// D-17..D-21). Every pre-existing assertion about code/format/timestamp/
// SCAN AGAIN stays green under the MATCH render path; the "SCANNED" heading
// becomes "MATCHED" to match the new vocabulary.
describe("ScanResultBanner — MATCH state legacy-migrated assertions (Phase 64 parity)", () => {
  beforeEach(() => {
    vi.mocked(formatScanTime).mockClear();
  });

  afterEach(() => cleanup());

  const matchItem: Item = {
    id: "item-42",
    workspace_id: "ws-1",
    sku: "SKU-042",
    name: "Coca-Cola 330ml",
    short_code: "CC3-A1",
    barcode: "ABC-123-XYZ",
    min_stock_level: 0,
    created_at: "2026-04-19T00:00:00Z",
    updated_at: "2026-04-19T00:00:00Z",
  };

  const defaultProps = {
    code: "ABC-123-XYZ",
    format: "qr_code",
    timestamp: 1700000000000,
    lookupStatus: "success" as const,
    match: matchItem,
    onScanAgain: vi.fn(),
    onViewItem: vi.fn(),
    onCreateWithBarcode: vi.fn(),
    onRetry: vi.fn(),
  };

  it("renders a MATCHED heading (Test 1 — migrated from SCANNED → MATCHED)", () => {
    renderWithI18n(<ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />);
    const heading = screen.getByRole("heading", { name: /MATCHED/i });
    expect(heading).toBeInTheDocument();
  });

  it("renders CODE label and match.short_code in a large monospace element (Test 2)", () => {
    renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />,
    );
    expect(screen.getByText("CODE")).toBeInTheDocument();
    // MATCH state renders match.short_code in the CODE row (24px mono bold).
    const codeEl = screen.getByText("CC3-A1");
    expect(codeEl).toBeInTheDocument();
    expect(codeEl.className).toContain("font-mono");
    expect(codeEl.className).toContain("text-[24px]");
  });

  it("renders FORMAT label and format in an amber pill (Test 3)", () => {
    renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />,
    );
    expect(screen.getByText("FORMAT")).toBeInTheDocument();
    const pill = screen.getByTestId("scan-format-pill");
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).toBe("qr_code");
    expect(pill.className).toContain("bg-retro-amber");
  });

  it("renders the timestamp via formatScanTime(timestamp) (Test 4)", () => {
    renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />,
    );
    expect(formatScanTime).toHaveBeenCalledWith(1700000000000);
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });

  it("renders a SCAN AGAIN primary button; click calls onScanAgain once (Test 5)", async () => {
    const user = userEvent.setup();
    const onScanAgain = vi.fn();
    renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={onScanAgain} />,
    );
    const btn = screen.getByRole("button", { name: /SCAN AGAIN/i });
    expect(btn).toBeInTheDocument();
    // Primary variant = amber background
    expect(btn.className).toContain("bg-retro-amber");
    await user.click(btn);
    expect(onScanAgain).toHaveBeenCalledTimes(1);
  });

  it("renders inside a RetroPanel (MATCH state — no hazard stripe) (Test 6 — migrated)", () => {
    // Migration note: Phase 64 banner had a yellow HazardStripe on every
    // render. Phase 65 MATCH state intentionally has NO stripe (clean
    // success UX). The original Test 6 asserted stripe presence; it now
    // asserts stripe absence in MATCH + RetroPanel chrome still present.
    const { container } = renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />,
    );
    const stripe = container.querySelector("[data-variant]");
    expect(stripe).toBeNull();
    // RetroPanel uses thick ink border + cream background
    const panel = container.querySelector(".border-retro-thick.border-retro-ink");
    expect(panel).toBeInTheDocument();
  });

  it("renders MANUAL format pill when format='MANUAL' (manual-entry path) (Test 7)", () => {
    renderWithI18n(
      <ScanResultBanner
        code="TYPED-001"
        format="MANUAL"
        timestamp={1700000000000}
        lookupStatus="success"
        match={{ ...matchItem, short_code: "TYPED-SC" }}
        onScanAgain={vi.fn()}
        onViewItem={vi.fn()}
        onCreateWithBarcode={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    const pill = screen.getByTestId("scan-format-pill");
    expect(pill.textContent).toBe("MANUAL");
  });
});
