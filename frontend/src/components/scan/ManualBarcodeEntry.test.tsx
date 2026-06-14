import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ManualBarcodeEntry } from "./ManualBarcodeEntry";

function renderEntry(onSubmit = vi.fn()) {
  render(
    <I18nProvider i18n={i18n}>
      <ManualBarcodeEntry onSubmit={onSubmit} />
    </I18nProvider>,
  );
  return onSubmit;
}

describe("ManualBarcodeEntry", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("disables the submit button while the field is blank", () => {
    renderEntry();
    expect(screen.getByRole("button", { name: /LOOK UP CODE/ })).toBeDisabled();
  });

  it("trims and funnels the code with the 'manual' source, then clears", async () => {
    const onSubmit = renderEntry();
    const input = screen.getByLabelText("ENTER CODE");
    await userEvent.type(input, "  0123456789012  ");
    await userEvent.click(screen.getByRole("button", { name: /LOOK UP CODE/ }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("0123456789012", "manual");
    expect(input).toHaveValue("");
  });

  it("Enter inside the field submits", async () => {
    const onSubmit = renderEntry();
    await userEvent.type(screen.getByLabelText("ENTER CODE"), "5901234123457{Enter}");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("5901234123457", "manual");
  });

  it("no-ops on a whitespace-only submit", async () => {
    const onSubmit = renderEntry();
    const input = screen.getByLabelText("ENTER CODE");
    await userEvent.type(input, "   ");
    // Button stays disabled, so a form submit cannot funnel a blank code.
    expect(screen.getByRole("button", { name: /LOOK UP CODE/ })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
