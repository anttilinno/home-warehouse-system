import { render, screen } from "@testing-library/react";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RetroEmptyState } from "../RetroEmptyState";
import { RetroButton } from "../RetroButton";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("RetroEmptyState", () => {
  it("renders title and default body", () => {
    renderWithI18n(<RetroEmptyState title="NO RECORDS YET" />);
    expect(screen.getByText("NO RECORDS YET")).toBeInTheDocument();
    expect(
      screen.getByText(/create your first entry to populate this list/i)
    ).toBeInTheDocument();
  });

  it("renders action slot when provided", () => {
    renderWithI18n(
      <RetroEmptyState
        title="EMPTY"
        action={<RetroButton>ADD ITEM</RetroButton>}
      />
    );
    expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
  });

  it("applies hazard stripe when showHazardStripe is true", () => {
    const { container } = renderWithI18n(
      <RetroEmptyState title="EMPTY" showHazardStripe />
    );
    expect(container.querySelector(".bg-hazard-stripe")).toBeInTheDocument();
  });
});
