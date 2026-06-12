import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { RetroFormField } from "./RetroFormField";

function wrap(ui: React.ReactNode) {
  return <I18nProvider i18n={i18n}>{ui}</I18nProvider>;
}

describe("RetroFormField", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders a 12px uppercase label wired to the control via htmlFor/id", () => {
    render(
      wrap(
        <RetroFormField label="Category">
          {(id) => <input id={id} aria-label="control" />}
        </RetroFormField>,
      ),
    );
    const label = screen.getByText("Category");
    expect(label.tagName).toBe("LABEL");
    expect(label.className).toContain("uppercase");
    const control = screen.getByLabelText("control");
    expect(label.getAttribute("for")).toBe(control.id);
    expect(control.id).toBeTruthy();
  });

  it("renders a hint below the control when no error is set", () => {
    render(
      wrap(
        <RetroFormField label="Category" hint="Pick one bucket">
          {(id) => <input id={id} aria-label="control" />}
        </RetroFormField>,
      ),
    );
    expect(screen.getByText("Pick one bucket")).toBeInTheDocument();
  });

  it("replaces the hint with a ✕-prefixed danger error, wired via aria-describedby", () => {
    render(
      wrap(
        <RetroFormField label="Category" hint="Pick one bucket" error="Required">
          {(id, describedBy) => (
            <input id={id} aria-describedby={describedBy} aria-label="control" />
          )}
        </RetroFormField>,
      ),
    );
    // Hint is gone, error shows.
    expect(screen.queryByText("Pick one bucket")).not.toBeInTheDocument();
    const err = screen.getByText(/Required/);
    expect(err.className).toContain("text-danger");
    expect(err.textContent).toContain("✕");
    // aria-describedby on the control references the error id.
    const control = screen.getByLabelText("control");
    expect(control.getAttribute("aria-describedby")).toBe(err.id);
  });

  it("renders an ink required marker after the label when required", () => {
    render(
      wrap(
        <RetroFormField label="Category" required>
          {(id) => <input id={id} aria-label="control" />}
        </RetroFormField>,
      ),
    );
    const marker = screen.getByText("*");
    expect(marker).toBeInTheDocument();
    // The marker is not the danger color (color is reserved for actual errors).
    expect(marker.className).not.toContain("text-danger");
  });
});
