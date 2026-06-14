import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { InlineEditCell } from "./InlineEditCell";

function wrap(ui: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("InlineEditCell", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the qty value at rest and enters edit on click", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    wrap(
      <InlineEditCell
        field="quantity"
        value={3}
        itemName="Drill"
        onCommit={onCommit}
      />,
    );
    // Rest state: the button labels the field + item.
    const trigger = screen.getByRole("button", {
      name: /edit quantity for drill/i,
    });
    expect(trigger).toHaveTextContent("3");

    await user.click(trigger);
    // Edit state: a number spinbutton appears.
    expect(
      screen.getByRole("spinbutton", { name: /edit quantity for drill/i }),
    ).toBeInTheDocument();
  });

  it("commits a new qty on Enter", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    wrap(
      <InlineEditCell
        field="quantity"
        value={3}
        itemName="Drill"
        onCommit={onCommit}
      />,
    );
    await user.click(screen.getByRole("button"));
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "9{Enter}");
    expect(onCommit).toHaveBeenCalledWith(9);
  });

  it("ESC reverts WITHOUT calling onCommit", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    wrap(
      <InlineEditCell
        field="quantity"
        value={3}
        itemName="Drill"
        onCommit={onCommit}
      />,
    );
    await user.click(screen.getByRole("button"));
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "9{Escape}");
    expect(onCommit).not.toHaveBeenCalled();
    // Back at rest with the original value.
    expect(screen.getByRole("button")).toHaveTextContent("3");
  });

  it("does NOT commit an invalid (negative / empty) qty", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    wrap(
      <InlineEditCell
        field="quantity"
        value={3}
        itemName="Drill"
        onCommit={onCommit}
      />,
    );
    await user.click(screen.getByRole("button"));
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    // Blur with an empty value cancels rather than firing a doomed request.
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveTextContent("3");
  });

  it("status select commits the chosen status on change+Enter", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    wrap(
      <InlineEditCell
        field="status"
        value="AVAILABLE"
        itemName="Drill"
        onCommit={onCommit}
      />,
    );
    await user.click(screen.getByRole("button", { name: /edit status/i }));
    const select = screen.getByRole("combobox", { name: /edit status/i });
    await user.selectOptions(select, "ON_LOAN");
    await user.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalledWith("ON_LOAN");
  });

  it("condition rest state shows the Title-Case label pill", () => {
    wrap(
      <InlineEditCell
        field="condition"
        value="FOR_REPAIR"
        itemName="Drill"
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByText("For repair")).toBeInTheDocument();
  });
});
