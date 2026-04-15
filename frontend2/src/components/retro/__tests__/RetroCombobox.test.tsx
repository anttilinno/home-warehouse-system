import { render, screen, act, fireEvent } from "@testing-library/react";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RetroCombobox } from "../RetroCombobox";

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

function getInput(): HTMLInputElement {
  return screen.getByRole("combobox") as HTMLInputElement;
}

describe("RetroCombobox", () => {
  it("renders role=combobox with aria-expanded=false by default", () => {
    renderWithI18n(<RetroCombobox options={[]} />);
    expect(getInput()).toHaveAttribute("aria-expanded", "false");
  });

  it("sets aria-expanded=true when listbox is open", () => {
    renderWithI18n(<RetroCombobox options={OPTIONS} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "a" } });
    expect(getInput()).toHaveAttribute("aria-expanded", "true");
  });

  it("fires onSearch with debounce after typing stops for 250ms", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    try {
      renderWithI18n(<RetroCombobox options={[]} onSearch={onSearch} />);
      const input = getInput();
      fireEvent.change(input, { target: { value: "abc" } });
      expect(onSearch).not.toHaveBeenCalledWith("abc");
      act(() => {
        vi.advanceTimersByTime(260);
      });
      expect(onSearch).toHaveBeenCalledWith("abc");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders loading message when loading=true", () => {
    renderWithI18n(<RetroCombobox options={[]} loading />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "q" } });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders empty message when no options and not loading", () => {
    renderWithI18n(<RetroCombobox options={[]} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "q" } });
    expect(screen.getByText(/no matches found/i)).toBeInTheDocument();
  });

  it("navigates options with ArrowDown/ArrowUp and sets aria-activedescendant", () => {
    renderWithI18n(<RetroCombobox options={OPTIONS} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getInput()).toHaveAttribute("aria-activedescendant");
  });

  it("selects option on Enter and calls onChange with option.value", () => {
    const onChange = vi.fn();
    renderWithI18n(<RetroCombobox options={OPTIONS} onChange={onChange} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("a");
  });
});
