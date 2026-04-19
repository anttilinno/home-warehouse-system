import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- Mocks must precede component imports ---

// 1. Real scanner library → test-infra stand-in so the <Scanner> component is
//    observable in lastScannerProps and tests can trigger decode/error paths.
vi.mock("@yudiel/react-qr-scanner", async () => {
  const mod = await import("@/test/mocks/yudiel-scanner");
  return mod;
});

// 2. Scanner lib — preserve real module shape (getScanHistory / add etc.) but
//    mock the side-effecting functions: initBarcodePolyfill, triggerScanFeedback,
//    resumeAudioContext.
vi.mock("@/lib/scanner", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scanner")>(
    "@/lib/scanner",
  );
  return {
    ...actual,
    initBarcodePolyfill: vi.fn().mockResolvedValue(undefined),
    triggerScanFeedback: vi.fn(),
    resumeAudioContext: vi.fn(),
  };
});

// 3. D-01 callsite lock — spy on useScanLookup so Test 15 can assert the call
//    shape. Returns the stub shape so non-lookup tests are unaffected.
vi.mock("../hooks/useScanLookup", () => ({
  useScanLookup: vi.fn(() => ({
    status: "idle" as const,
    match: null,
    error: null,
    refetch: () => {},
  })),
}));

import { ScanPage } from "../ScanPage";
import {
  lastScannerProps,
  triggerDecode,
  triggerScannerError,
  resetScannerMock,
  Scanner,
} from "@/test/mocks/yudiel-scanner";
import { installMediaDevicesMock } from "@/test/mocks/media-devices";
import { useScanLookup } from "../hooks/useScanLookup";
import { renderWithProviders, setupDialogMocks } from "./fixtures";

const useScanLookupSpy = vi.mocked(useScanLookup);

// Shared media-devices restorer
let restoreMediaDevices: (() => void) | null = null;

describe("ScanPage (Phase 64 orchestration)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetScannerMock();
    useScanLookupSpy.mockClear();
    setupDialogMocks();
    const installed = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = installed.restore;
  });

  afterEach(() => {
    cleanup();
    restoreMediaDevices?.();
    restoreMediaDevices = null;
    vi.clearAllMocks();
  });

  describe("tab switching", () => {
    // --- Test 1: default tab SCAN ---
    it("mounts with the SCAN tab active (default per D-05)", async () => {
      renderWithProviders(<ScanPage />);
      // The mock Scanner is in the DOM on the Scan tab.
      expect(
        await screen.findByTestId("fake-scanner-decode-trigger"),
      ).toBeInTheDocument();
      // No manual form, no history empty state.
      expect(
        screen.queryByRole("button", { name: /LOOK UP CODE/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: /NO SCANS YET/i }),
      ).not.toBeInTheDocument();
    });

    // --- Test 2: tab switch to MANUAL ---
    it("switches to MANUAL tab and removes the Scanner from DOM", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScanPage />);
      await user.click(screen.getByRole("button", { name: /^MANUAL$/i }));
      expect(
        screen.getByRole("button", { name: /LOOK UP CODE/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("fake-scanner-decode-trigger"),
      ).not.toBeInTheDocument();
    });

    // --- Test 3: tab switch to HISTORY ---
    it("switches to HISTORY tab showing NO SCANS YET empty state", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScanPage />);
      await user.click(screen.getByRole("button", { name: /^HISTORY$/i }));
      expect(
        screen.getByRole("heading", { name: /NO SCANS YET/i }),
      ).toBeInTheDocument();
    });
  });

  describe("AudioContext prime (D-08)", () => {
    // --- Test 4: pointerdown prime called at most once ---
    it("calls useScanFeedback.prime() at most once regardless of pointerdown count", async () => {
      const { resumeAudioContext } = await import("@/lib/scanner");
      const resumeSpy = vi.mocked(resumeAudioContext);
      resumeSpy.mockClear();
      const user = userEvent.setup();
      const { container } = renderWithProviders(<ScanPage />);
      const root = container.querySelector(
        "[data-testid='scan-page-root']",
      ) as HTMLElement | null;
      expect(root).not.toBeNull();
      await user.pointer({ target: root!, keys: "[MouseLeft]" });
      await user.pointer({ target: root!, keys: "[MouseLeft]" });
      await user.pointer({ target: root!, keys: "[MouseLeft]" });
      expect(resumeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("post-decode flow (D-02/D-03)", () => {
    // --- Test 5: decode → banner + paused + feedback + history ---
    it("shows banner, pauses scanner, fires feedback, writes history on decode", async () => {
      const { triggerScanFeedback, getScanHistory } = await import(
        "@/lib/scanner"
      );
      const triggerSpy = vi.mocked(triggerScanFeedback);
      triggerSpy.mockClear();
      renderWithProviders(<ScanPage />);
      // Wait until Scanner is mounted.
      await screen.findByTestId("fake-scanner-decode-trigger");
      triggerDecode("ABC-123", "qr_code");
      // Banner appears.
      const heading = await screen.findByRole("heading", { name: /LOOKING UP/i });
      expect(heading).toBeInTheDocument();
      expect(screen.getByText("ABC-123")).toBeInTheDocument();
      // Scanner `paused` prop reflects state.
      await waitFor(() => expect(lastScannerProps.current.paused).toBe(true));
      // Feedback triggered exactly once.
      expect(triggerSpy).toHaveBeenCalledTimes(1);
      // Persisted to history.
      const history = getScanHistory();
      expect(history).toHaveLength(1);
      expect(history[0].code).toBe("ABC-123");
    });

    // --- Test 6: dedupe (D-03) ---
    it("dedupes consecutive same-code decodes to a single history entry", async () => {
      const { getScanHistory } = await import("@/lib/scanner");
      renderWithProviders(<ScanPage />);
      await screen.findByTestId("fake-scanner-decode-trigger");
      triggerDecode("DUPE-42", "qr_code");
      await screen.findByRole("heading", { name: /LOOKING UP/i });
      // Dismiss banner, scanner unpauses, scan the same code again.
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /SCAN AGAIN/i }));
      triggerDecode("DUPE-42", "qr_code");
      await waitFor(() =>
        expect(screen.getByRole("heading", { name: /LOOKING UP/i })).toBeInTheDocument(),
      );
      expect(getScanHistory()).toHaveLength(1);
    });

    // --- Test 7: SCAN AGAIN clears banner and unpauses ---
    it("SCAN AGAIN clears the banner and unpauses the scanner", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScanPage />);
      await screen.findByTestId("fake-scanner-decode-trigger");
      triggerDecode("SA-01", "qr_code");
      await screen.findByRole("heading", { name: /LOOKING UP/i });
      expect(lastScannerProps.current.paused).toBe(true);
      await user.click(screen.getByRole("button", { name: /SCAN AGAIN/i }));
      expect(
        screen.queryByRole("heading", { name: /LOOKING UP/i }),
      ).not.toBeInTheDocument();
      await waitFor(() => expect(lastScannerProps.current.paused).toBe(false));
    });
  });

  describe("manual submit", () => {
    // --- Test 8: manual submit with MANUAL format ---
    it("manual submit writes history + shows banner with format=MANUAL", async () => {
      const { getScanHistory } = await import("@/lib/scanner");
      const user = userEvent.setup();
      renderWithProviders(<ScanPage />);
      await user.click(screen.getByRole("button", { name: /^MANUAL$/i }));
      const input = screen.getByPlaceholderText(/Enter code manually/i);
      await user.type(input, "MY-CODE-42");
      await user.click(screen.getByRole("button", { name: /LOOK UP CODE/i }));
      // Banner rendered with MANUAL format.
      await screen.findByRole("heading", { name: /LOOKING UP/i });
      expect(screen.getByText("MY-CODE-42")).toBeInTheDocument();
      const pill = screen.getByTestId("scan-format-pill");
      expect(pill.textContent).toBe("MANUAL");
      // History persisted.
      const history = getScanHistory();
      expect(history).toHaveLength(1);
      expect(history[0].code).toBe("MY-CODE-42");
      expect(history[0].format).toBe("MANUAL");
    });
  });

  describe("history tap (D-15 + D-20)", () => {
    // --- Test 9: history tap re-fires on current tab (HISTORY) ---
    it("history tap re-fires post-scan flow on HISTORY tab (no auto-switch)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScanPage />);
      // Seed a history entry via manual submit
      await user.click(screen.getByRole("button", { name: /^MANUAL$/i }));
      await user.type(
        screen.getByPlaceholderText(/Enter code manually/i),
        "HIST-01",
      );
      await user.click(screen.getByRole("button", { name: /LOOK UP CODE/i }));
      await screen.findByRole("heading", { name: /LOOKING UP/i });
      // Dismiss banner
      await user.click(screen.getByRole("button", { name: /SCAN AGAIN/i }));
      // Go to HISTORY tab
      await user.click(screen.getByRole("button", { name: /^HISTORY$/i }));
      // Tap the row
      const row = screen.getAllByRole("button", { name: /HIST-01/i })[0];
      await user.click(row);
      // Banner renders ON history tab (list still visible)
      expect(
        await screen.findByRole("heading", { name: /LOOKING UP/i }),
      ).toBeInTheDocument();
      // We stay on HISTORY tab — the SCAN HISTORY heading/list is still visible
      expect(
        screen.getByRole("heading", { name: /SCAN HISTORY/i }),
      ).toBeInTheDocument();
      // Scanner (SCAN tab body) is NOT in DOM — we did not auto-switch (D-20)
      expect(
        screen.queryByTestId("fake-scanner-decode-trigger"),
      ).not.toBeInTheDocument();
    });

    // --- Test 10: clear history ---
    it("CLEAR HISTORY → YES, CLEAR empties the list to NO SCANS YET", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScanPage />);
      // Seed via manual
      await user.click(screen.getByRole("button", { name: /^MANUAL$/i }));
      await user.type(
        screen.getByPlaceholderText(/Enter code manually/i),
        "CLR-01",
      );
      await user.click(screen.getByRole("button", { name: /LOOK UP CODE/i }));
      await screen.findByRole("heading", { name: /LOOKING UP/i });
      // Clear it on HISTORY tab
      await user.click(screen.getByRole("button", { name: /SCAN AGAIN/i }));
      await user.click(screen.getByRole("button", { name: /^HISTORY$/i }));
      await user.click(screen.getByRole("button", { name: /CLEAR HISTORY/i }));
      await user.click(
        await screen.findByRole("button", { name: /YES, CLEAR/i }),
      );
      expect(
        await screen.findByRole("heading", { name: /NO SCANS YET/i }),
      ).toBeInTheDocument();
    });
  });

  describe("error routing", () => {
    // --- Test 11: permission-denied routes to panel ---
    it("permission-denied error shows the permission-denied ScanErrorPanel on Scan tab", async () => {
      renderWithProviders(<ScanPage />);
      await screen.findByTestId("fake-scanner-decode-trigger");
      const err = Object.assign(new Error("denied"), {
        name: "NotAllowedError",
      });
      triggerScannerError(err);
      expect(
        await screen.findByRole("heading", { name: /CAMERA ACCESS DENIED/i }),
      ).toBeInTheDocument();
      // Tabs remain usable
      expect(
        screen.getByRole("button", { name: /^MANUAL$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^HISTORY$/i }),
      ).toBeInTheDocument();
    });

    // --- Test 12: USE MANUAL ENTRY switches tab to MANUAL ---
    it("USE MANUAL ENTRY in error panel switches the tab to MANUAL (D-10)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScanPage />);
      await screen.findByTestId("fake-scanner-decode-trigger");
      const err = Object.assign(new Error("denied"), {
        name: "NotAllowedError",
      });
      triggerScannerError(err);
      await screen.findByRole("heading", { name: /CAMERA ACCESS DENIED/i });
      await user.click(
        screen.getByRole("button", { name: /USE MANUAL ENTRY/i }),
      );
      expect(
        await screen.findByRole("button", { name: /LOOK UP CODE/i }),
      ).toBeInTheDocument();
    });

    // --- Test 13: library-init-fail RETRY remounts Scanner (D-19 narrowed) ---
    it("library-init-fail RETRY clears error + bumps scannerKey, remounting BarcodeScanner", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScanPage />);
      await screen.findByTestId("fake-scanner-decode-trigger");
      const initialCalls = (Scanner as unknown as { mock: { calls: unknown[] } })
        .mock.calls.length;
      // Fire a generic error — maps to library-init-fail in BarcodeScanner.
      triggerScannerError(new Error("boom"));
      expect(
        await screen.findByRole("heading", { name: /SCANNER FAILED TO LOAD/i }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^RETRY$/i }));
      // Panel cleared
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { name: /SCANNER FAILED TO LOAD/i }),
        ).not.toBeInTheDocument(),
      );
      // Scanner was remounted at least once more after the initial mount.
      await waitFor(() => {
        const totalCalls = (Scanner as unknown as {
          mock: { calls: unknown[] };
        }).mock.calls.length;
        expect(totalCalls).toBeGreaterThan(initialCalls);
      });
    });
  });

  describe("banner on current tab (D-20)", () => {
    // --- Test 14: decode while on HISTORY still shows banner, no auto-switch ---
    it("decode while on HISTORY tab renders the banner there (no auto-switch)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScanPage />);
      await screen.findByTestId("fake-scanner-decode-trigger");
      // Switch to HISTORY first
      await user.click(screen.getByRole("button", { name: /^HISTORY$/i }));
      expect(
        screen.getByRole("heading", { name: /NO SCANS YET/i }),
      ).toBeInTheDocument();
      triggerDecode("HX-99", "qr_code");
      // Banner appears, AND we're still on HISTORY tab (NO SCANS YET header
      // replaced by SCAN HISTORY once an entry exists).
      await screen.findByRole("heading", { name: /LOOKING UP/i });
      expect(
        screen.getByRole("heading", { name: /SCAN HISTORY/i }),
      ).toBeInTheDocument();
      // The SCAN tab body (the mock Scanner) is NOT in the DOM.
      expect(
        screen.queryByTestId("fake-scanner-decode-trigger"),
      ).not.toBeInTheDocument();
    });
  });

  describe("useScanLookup callsite lock (D-01, Phase 65 swap point)", () => {
    // --- Test 15: useScanLookup called with null pre-decode and with code post-decode ---
    it("ScanPage invokes useScanLookup(null) pre-decode and useScanLookup(code) post-decode", async () => {
      renderWithProviders(<ScanPage />);
      await screen.findByTestId("fake-scanner-decode-trigger");
      // Pre-decode — banner is null, so the callsite passes null.
      expect(useScanLookupSpy).toHaveBeenCalled();
      expect(useScanLookupSpy).toHaveBeenCalledWith(null);
      // Trigger a decode — banner.code becomes "ABC-123".
      triggerDecode("ABC-123", "qr_code");
      await screen.findByRole("heading", { name: /LOOKING UP/i });
      await waitFor(() =>
        expect(useScanLookupSpy).toHaveBeenCalledWith("ABC-123"),
      );
    });
  });
});
