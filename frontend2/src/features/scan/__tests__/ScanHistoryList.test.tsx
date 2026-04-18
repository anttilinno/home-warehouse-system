import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock formatScanTime so timestamps render deterministically.
vi.mock("@/lib/scanner", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scanner")>(
    "@/lib/scanner",
  );
  return {
    ...actual,
    formatScanTime: vi.fn((ts: number) => `ts:${ts}`),
  };
});

import { ScanHistoryList } from "../ScanHistoryList";
import {
  renderWithProviders,
  setupDialogMocks,
  makeScanHistoryEntry,
} from "./fixtures";
import { formatScanTime } from "@/lib/scanner";

describe("ScanHistoryList (SCAN-06 + SCAN-07)", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.mocked(formatScanTime).mockClear();
  });

  afterEach(() => cleanup());

  // --- Test 1: empty state ---
  it("renders NO SCANS YET empty state with no CLEAR HISTORY button", () => {
    const onSelect = vi.fn();
    const onClear = vi.fn();
    renderWithProviders(
      <ScanHistoryList entries={[]} onSelect={onSelect} onClear={onClear} />,
    );
    expect(
      screen.getByRole("heading", { name: /NO SCANS YET/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Scanned codes appear here\. Your last 10 scans are kept on this device\./i,
      ),
    ).toBeInTheDocument();
    // No CLEAR HISTORY button when empty — nothing to clear.
    expect(
      screen.queryByRole("button", { name: /CLEAR HISTORY/i }),
    ).not.toBeInTheDocument();
  });

  // --- Test 2: rows render with code, format, timestamp ---
  it("renders one row per entry with code, format, and formatted timestamp", () => {
    const entries = [
      makeScanHistoryEntry({ code: "AAA-111", format: "qr_code", timestamp: 1 }),
      makeScanHistoryEntry({ code: "BBB-222", format: "ean_13", timestamp: 2 }),
      makeScanHistoryEntry({ code: "CCC-333", format: "code_128", timestamp: 3 }),
    ];
    renderWithProviders(
      <ScanHistoryList
        entries={entries}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);

    expect(screen.getByText("AAA-111")).toBeInTheDocument();
    expect(screen.getByText("BBB-222")).toBeInTheDocument();
    expect(screen.getByText("CCC-333")).toBeInTheDocument();

    expect(screen.getByText("qr_code")).toBeInTheDocument();
    expect(screen.getByText("ean_13")).toBeInTheDocument();
    expect(screen.getByText("code_128")).toBeInTheDocument();

    // formatScanTime rendered per row
    expect(formatScanTime).toHaveBeenCalledWith(1);
    expect(formatScanTime).toHaveBeenCalledWith(2);
    expect(formatScanTime).toHaveBeenCalledWith(3);
    expect(screen.getByText("ts:1")).toBeInTheDocument();
    expect(screen.getByText("ts:2")).toBeInTheDocument();
    expect(screen.getByText("ts:3")).toBeInTheDocument();
  });

  // --- Test 3: tapping a row fires onSelect with the entry ---
  it("calls onSelect(entry) when a row is clicked (D-15 re-fire post-scan flow)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const entries = [
      makeScanHistoryEntry({ code: "AAA-111", timestamp: 1 }),
      makeScanHistoryEntry({ code: "BBB-222", timestamp: 2 }),
    ];
    renderWithProviders(
      <ScanHistoryList
        entries={entries}
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole("button", { name: /BBB-222/i });
    // The row button wraps code + format + timestamp; accessible name includes
    // "BBB-222" + "qr_code" + "ts:2". getAllByRole allows us to pick the right one.
    await user.click(rows[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(entries[1]);
  });

  // --- Test 4: each row button has >=44px tap target class ---
  it("each row button is a >=44px tappable target (min-h-[44px])", () => {
    const entries = [
      makeScanHistoryEntry({ code: "AAA-111", timestamp: 1 }),
      makeScanHistoryEntry({ code: "BBB-222", timestamp: 2 }),
    ];
    const { container } = renderWithProviders(
      <ScanHistoryList
        entries={entries}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const rowButtons = container.querySelectorAll(
      "li[role='listitem'] button[type='button']",
    );
    expect(rowButtons.length).toBe(2);
    for (const btn of rowButtons) {
      expect(btn.className).toContain("min-h-[44px]");
    }
  });

  // --- Test 5: CLEAR HISTORY button visible when entries exist ---
  it("renders a CLEAR HISTORY danger button when entries exist", () => {
    const entries = [makeScanHistoryEntry({ code: "AAA-111", timestamp: 1 })];
    renderWithProviders(
      <ScanHistoryList
        entries={entries}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /CLEAR HISTORY/i });
    expect(btn).toBeInTheDocument();
    // Danger variant = red background
    expect(btn.className).toContain("bg-retro-red");
  });

  // --- Test 6: confirm affirm ---
  it("CLEAR HISTORY opens confirm dialog and YES, CLEAR calls onClear once", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const entries = [makeScanHistoryEntry({ code: "AAA-111", timestamp: 1 })];
    renderWithProviders(
      <ScanHistoryList
        entries={entries}
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByRole("button", { name: /CLEAR HISTORY/i }));
    expect(
      await screen.findByText(/CLEAR SCAN HISTORY/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /All 10 most-recent scanned codes on this device will be removed\. This cannot be undone\./i,
      ),
    ).toBeInTheDocument();
    const affirm = screen.getByRole("button", { name: /YES, CLEAR/i });
    await user.click(affirm);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  // --- Test 7: confirm cancel ---
  it("CLEAR HISTORY → KEEP HISTORY does NOT call onClear", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const entries = [makeScanHistoryEntry({ code: "AAA-111", timestamp: 1 })];
    renderWithProviders(
      <ScanHistoryList
        entries={entries}
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByRole("button", { name: /CLEAR HISTORY/i }));
    const cancel = await screen.findByRole("button", {
      name: /KEEP HISTORY/i,
    });
    await user.click(cancel);
    expect(onClear).not.toHaveBeenCalled();
  });

  // --- Test 8: no in-component dedupe (straight render of entries) ---
  it("renders duplicate codes if parent passes them (no in-component dedupe)", () => {
    const entries = [
      makeScanHistoryEntry({ code: "DUP-001", timestamp: 1 }),
      makeScanHistoryEntry({ code: "DUP-001", timestamp: 2 }),
    ];
    renderWithProviders(
      <ScanHistoryList
        entries={entries}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });

  // --- Test 9: key stability — same entry still fires onSelect after reorder ---
  it("row keys are stable by code+timestamp (onSelect still fires after reorder)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const a = makeScanHistoryEntry({ code: "AAA-111", timestamp: 1 });
    const b = makeScanHistoryEntry({ code: "BBB-222", timestamp: 2 });
    const { rerender } = renderWithProviders(
      <ScanHistoryList
        entries={[a, b]}
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    );
    // Reorder — list rerender should not break event wiring
    rerender(
      <ScanHistoryList
        entries={[b, a]}
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    );
    const btnB = screen.getAllByRole("button", { name: /BBB-222/i })[0];
    await user.click(btnB);
    expect(onSelect).toHaveBeenCalledWith(b);
  });
});
