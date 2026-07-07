import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { RetroEmptyState } from "./RetroEmptyState";

function renderEmpty(ui: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("RetroEmptyState", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders eyebrow, glyph, heading, and body", () => {
    const { container } = renderEmpty(
      <RetroEmptyState
        eyebrow="INVENTORY"
        glyph="folder"
        heading="NOTHING HERE YET"
        body="This list is empty. Add your first item to get started."
      />,
    );
    expect(screen.getByText("INVENTORY")).toBeInTheDocument();
    // The glyph is an aria-hidden Pixelarticons svg in the thumb frame.
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "NOTHING HERE YET" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This list is empty. Add your first item to get started.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the no-data copy", () => {
    renderEmpty(
      <RetroEmptyState
        heading="NOTHING HERE YET"
        body="This list is empty. Add your first item to get started."
      />,
    );
    expect(screen.getByText("NOTHING HERE YET")).toBeInTheDocument();
  });

  it("renders the filtered-results copy", () => {
    renderEmpty(
      <RetroEmptyState
        heading="NO MATCHES"
        body="No items match these filters. Clear a filter or adjust your search."
      />,
    );
    expect(screen.getByText("NO MATCHES")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No items match these filters. Clear a filter or adjust your search.",
      ),
    ).toBeInTheDocument();
  });

  it("renders an optional action and fires its onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderEmpty(
      <RetroEmptyState
        heading="NOTHING HERE YET"
        body="empty"
        action={{ label: "ADD ITEM", onClick }}
      />,
    );
    const btn = screen.getByRole("button", { name: "ADD ITEM" });
    await user.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("omits the action button when no action is given", () => {
    renderEmpty(<RetroEmptyState heading="NO MATCHES" body="x" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
