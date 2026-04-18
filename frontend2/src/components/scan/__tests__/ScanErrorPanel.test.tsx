import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ScanErrorPanel, type ScanErrorKind } from "../ScanErrorPanel";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("ScanErrorPanel (D-09 four variants + D-10/11/12 telemetry)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // Test 1: permission-denied
  // -----------------------------------------------------------------------
  it("permission-denied: heading + 3 platform hints + USE MANUAL ENTRY; yellow stripe (Test 1)", async () => {
    const user = userEvent.setup();
    const onUseManualEntry = vi.fn();
    const { container } = renderWithI18n(
      <ScanErrorPanel
        kind="permission-denied"
        onUseManualEntry={onUseManualEntry}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /CAMERA ACCESS DENIED/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Settings → Safari → Camera/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/lock icon in the address bar/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/browser's site settings/),
    ).toBeInTheDocument();
    const useManualBtn = screen.getByRole("button", {
      name: /USE MANUAL ENTRY/i,
    });
    expect(useManualBtn).toBeInTheDocument();
    // No retry / reload on this variant
    expect(screen.queryByRole("button", { name: /RETRY/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /RELOAD PAGE/i })).toBeNull();
    // HazardStripe yellow (default for non-library-init variants)
    expect(container.querySelector('[data-variant="yellow"]')).toBeInTheDocument();
    await user.click(useManualBtn);
    expect(onUseManualEntry).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Test 2: no-camera
  // -----------------------------------------------------------------------
  it("no-camera: heading + USE MANUAL ENTRY + RELOAD PAGE; yellow stripe (Test 2)", async () => {
    const user = userEvent.setup();
    const onUseManualEntry = vi.fn();
    const onReload = vi.fn();
    const { container } = renderWithI18n(
      <ScanErrorPanel
        kind="no-camera"
        onUseManualEntry={onUseManualEntry}
        onReload={onReload}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /NO CAMERA FOUND/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /USE MANUAL ENTRY/i }),
    ).toBeInTheDocument();
    const reloadBtn = screen.getByRole("button", { name: /RELOAD PAGE/i });
    expect(reloadBtn).toBeInTheDocument();
    expect(container.querySelector('[data-variant="yellow"]')).toBeInTheDocument();
    await user.click(reloadBtn);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Test 3: library-init-fail — RED hazard stripe
  // -----------------------------------------------------------------------
  it("library-init-fail: heading + RETRY primary + USE MANUAL ENTRY; RED stripe (Test 3)", async () => {
    const user = userEvent.setup();
    const onUseManualEntry = vi.fn();
    const onRetry = vi.fn();
    const { container } = renderWithI18n(
      <ScanErrorPanel
        kind="library-init-fail"
        onUseManualEntry={onUseManualEntry}
        onRetry={onRetry}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /SCANNER FAILED TO LOAD/i }),
    ).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /RETRY/i });
    expect(retryBtn).toBeInTheDocument();
    // RETRY is primary (amber fill)
    expect(retryBtn.className).toContain("bg-retro-amber");
    expect(
      screen.getByRole("button", { name: /USE MANUAL ENTRY/i }),
    ).toBeInTheDocument();
    // HazardStripe RED for transient infra failure
    expect(container.querySelector('[data-variant="red"]')).toBeInTheDocument();
    expect(container.querySelector('[data-variant="yellow"]')).toBeNull();
    await user.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Test 4: unsupported-browser
  // -----------------------------------------------------------------------
  it("unsupported-browser: heading + USE MANUAL ENTRY only; no retry; yellow stripe (Test 4)", () => {
    const { container } = renderWithI18n(
      <ScanErrorPanel
        kind="unsupported-browser"
        onUseManualEntry={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /SCANNING UNSUPPORTED/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /USE MANUAL ENTRY/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /RETRY/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /RELOAD PAGE/i })).toBeNull();
    expect(container.querySelector('[data-variant="yellow"]')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Test 5: telemetry (D-12) — parameterized per variant
  // -----------------------------------------------------------------------
  describe.each([
    "permission-denied",
    "no-camera",
    "library-init-fail",
    "unsupported-browser",
  ] as const satisfies readonly ScanErrorKind[])(
    "telemetry for kind=%s (Test 5, D-12)",
    (kind) => {
      it(`logs structured console.error({ kind, errorName, userAgent, timestamp }) once on mount`, () => {
        renderWithI18n(
          <ScanErrorPanel
            kind={kind}
            onUseManualEntry={vi.fn()}
            onRetry={kind === "library-init-fail" ? vi.fn() : undefined}
            onReload={kind === "no-camera" ? vi.fn() : undefined}
          />,
        );
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            kind,
            errorName: kind,
            userAgent: expect.any(String),
            timestamp: expect.any(Number),
          }),
        );
      });
    },
  );

  // -----------------------------------------------------------------------
  // Test 6: library-init-fail without onRetry — RETRY button NOT rendered
  // -----------------------------------------------------------------------
  it("library-init-fail without onRetry does NOT render RETRY (defensive) (Test 6)", () => {
    renderWithI18n(
      <ScanErrorPanel
        kind="library-init-fail"
        onUseManualEntry={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /RETRY/i })).toBeNull();
    // USE MANUAL ENTRY still present
    expect(
      screen.getByRole("button", { name: /USE MANUAL ENTRY/i }),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Test 7: no-camera without onReload — RELOAD PAGE NOT rendered
  // -----------------------------------------------------------------------
  it("no-camera without onReload does NOT render RELOAD PAGE (Test 7)", () => {
    renderWithI18n(
      <ScanErrorPanel kind="no-camera" onUseManualEntry={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /RELOAD PAGE/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /USE MANUAL ENTRY/i }),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Test 8: body copy renders for each variant (readability sanity)
  // -----------------------------------------------------------------------
  it("each variant renders its body-copy sentence (Test 8)", () => {
    const { rerender } = renderWithI18n(
      <ScanErrorPanel kind="permission-denied" onUseManualEntry={vi.fn()} />,
    );
    expect(
      screen.getByText(/Barcode scanning needs camera permission/i),
    ).toBeInTheDocument();

    rerender(
      <I18nProvider i18n={i18n}>
        <ScanErrorPanel kind="no-camera" onUseManualEntry={vi.fn()} />
      </I18nProvider>,
    );
    expect(
      screen.getByText(/device does not report a working camera/i),
    ).toBeInTheDocument();

    rerender(
      <I18nProvider i18n={i18n}>
        <ScanErrorPanel
          kind="library-init-fail"
          onUseManualEntry={vi.fn()}
          onRetry={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(
      screen.getByText(/barcode engine could not initialize/i),
    ).toBeInTheDocument();

    rerender(
      <I18nProvider i18n={i18n}>
        <ScanErrorPanel
          kind="unsupported-browser"
          onUseManualEntry={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(
      screen.getByText(/browser does not support camera scanning/i),
    ).toBeInTheDocument();
  });
});
