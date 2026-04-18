import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ManualBarcodeEntry } from "../ManualBarcodeEntry";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("ManualBarcodeEntry (SCAN-05, D-14)", () => {
  afterEach(() => cleanup());

  it("renders an input (role=textbox) and a submit button labelled LOOK UP CODE (Test 1)", () => {
    renderWithI18n(<ManualBarcodeEntry onSubmit={vi.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /LOOK UP CODE/i }),
    ).toBeInTheDocument();
  });

  it("submit button is disabled when input is empty (Test 2)", () => {
    renderWithI18n(<ManualBarcodeEntry onSubmit={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /LOOK UP CODE/i });
    expect(btn).toBeDisabled();
  });

  it("submit button is disabled when input is whitespace-only (Test 3)", async () => {
    const user = userEvent.setup();
    renderWithI18n(<ManualBarcodeEntry onSubmit={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "   ");
    const btn = screen.getByRole("button", { name: /LOOK UP CODE/i });
    expect(btn).toBeDisabled();
  });

  it("submit button is ENABLED when input has >= 1 trimmed character (Test 4)", async () => {
    const user = userEvent.setup();
    renderWithI18n(<ManualBarcodeEntry onSubmit={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "A");
    const btn = screen.getByRole("button", { name: /LOOK UP CODE/i });
    expect(btn).not.toBeDisabled();
  });

  it("submitting with a valid value calls onSubmit(trimmed) (Test 5)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithI18n(<ManualBarcodeEntry onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "  ABC-123  ");
    await user.click(screen.getByRole("button", { name: /LOOK UP CODE/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("ABC-123");
  });

  it("submitting clears the input afterwards (Test 6)", async () => {
    const user = userEvent.setup();
    renderWithI18n(<ManualBarcodeEntry onSubmit={vi.fn()} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.type(input, "ABC-123");
    await user.click(screen.getByRole("button", { name: /LOOK UP CODE/i }));
    expect(input.value).toBe("");
  });

  it("oversize input is either clamped to 256 chars (maxLength) or blocked with inline error (Test 7)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithI18n(<ManualBarcodeEntry onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    const longString = "X".repeat(260);
    // fireEvent-style paste via userEvent to bypass maxLength restriction if present.
    await user.click(input);
    await user.paste(longString);

    if (input.value.length > 256) {
      // Implementation let the overlong string through — assert error guard fires
      await user.click(screen.getByRole("button", { name: /LOOK UP CODE/i }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(
        screen.getByText(/256 characters or fewer/i),
      ).toBeInTheDocument();
    } else {
      // Input was clamped by maxLength=256 — value cannot exceed 256
      expect(input.value.length).toBeLessThanOrEqual(256);
      // Submit should succeed because clamped value is valid
      await user.click(screen.getByRole("button", { name: /LOOK UP CODE/i }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    }
  });

  it("input element has the required HTML attributes (Test 8)", () => {
    renderWithI18n(<ManualBarcodeEntry onSubmit={vi.fn()} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("autoComplete", "off");
    expect(input).toHaveAttribute("autoCapitalize", "off");
    expect(input).toHaveAttribute("autoCorrect", "off");
    expect(input).toHaveAttribute("spellCheck", "false");
    expect(input).toHaveAttribute("maxLength", "256");
  });

  it("pressing Enter in the input submits the form (Test 9)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithI18n(<ManualBarcodeEntry onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "ABC{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("ABC");
  });

  it("the label 'BARCODE OR CODE' is associated with the input via htmlFor/id (Test 10)", () => {
    renderWithI18n(<ManualBarcodeEntry onSubmit={vi.fn()} />);
    const label = screen.getByText("BARCODE OR CODE");
    expect(label).toBeInTheDocument();
    // label is <label htmlFor="..."> and input has matching id
    const htmlFor = label.getAttribute("for");
    expect(htmlFor).toBeTruthy();
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("id")).toBe(htmlFor);
  });

  it("shows inline error when submitting an empty-after-trim value via Enter (Test 11 — defensive)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithI18n(<ManualBarcodeEntry onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox");
    // Button is disabled on empty input, but pressing Enter in input fires form submit
    await user.type(input, "   {Enter}");
    // Whitespace-only: either onSubmit is NOT called, or inline error shown
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
