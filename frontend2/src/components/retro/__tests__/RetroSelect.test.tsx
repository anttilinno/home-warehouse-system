import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RetroSelect } from "../RetroSelect";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

describe("RetroSelect", () => {
  it("renders a trigger button with placeholder when no value", () => {
    renderWithI18n(
      <RetroSelect options={OPTIONS} placeholder="Select category" />
    );
    expect(
      screen.getByRole("combobox", { name: /select category/i })
    ).toBeInTheDocument();
  });

  it("opens listbox on click and renders role=option per option", async () => {
    const user = userEvent.setup();
    renderWithI18n(<RetroSelect options={OPTIONS} placeholder="pick" />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("selects an option on Enter after ArrowDown to it and calls onChange with option.value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithI18n(
      <RetroSelect options={OPTIONS} onChange={onChange} placeholder="pick" />
    );
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("closes the listbox on Escape without selecting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithI18n(
      <RetroSelect options={OPTIONS} onChange={onChange} placeholder="pick" />
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies error border to trigger when error prop is set", () => {
    renderWithI18n(
      <RetroSelect options={OPTIONS} error="required" placeholder="pick" />
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger.className).toContain("border-retro-red");
  });

  it("forwards ref to trigger button", () => {
    const ref = createRef<HTMLButtonElement>();
    renderWithI18n(
      <RetroSelect ref={ref} options={OPTIONS} placeholder="pick" />
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
