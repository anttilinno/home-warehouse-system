import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("RetroCombobox", () => {
  it("renders role=combobox with aria-expanded=false by default", () => {
    renderWithI18n(<RetroCombobox options={[]} />);
    const cb = screen.getByRole("combobox");
    expect(cb).toHaveAttribute("aria-expanded", "false");
  });

  it("sets aria-expanded=true when listbox is open", async () => {
    const user = userEvent.setup();
    renderWithI18n(<RetroCombobox options={OPTIONS} />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "a");
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("fires onSearch with debounce after typing stops for 250ms", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime.bind(vi),
    });
    try {
      renderWithI18n(<RetroCombobox options={[]} onSearch={onSearch} />);
      const input = screen.getByRole("combobox");
      await user.type(input, "abc");
      expect(onSearch).not.toHaveBeenCalledWith("abc");
      act(() => {
        vi.advanceTimersByTime(260);
      });
      expect(onSearch).toHaveBeenCalledWith("abc");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders loading message when loading=true", async () => {
    const user = userEvent.setup();
    renderWithI18n(<RetroCombobox options={[]} loading />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "q");
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders empty message when no options and not loading", async () => {
    const user = userEvent.setup();
    renderWithI18n(<RetroCombobox options={[]} />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "q");
    expect(screen.getByText(/no matches found/i)).toBeInTheDocument();
  });

  it("navigates options with ArrowDown/ArrowUp and sets aria-activedescendant", async () => {
    const user = userEvent.setup();
    renderWithI18n(<RetroCombobox options={OPTIONS} />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "a");
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant");
  });

  it("selects option on Enter and calls onChange with option.value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithI18n(
      <RetroCombobox options={OPTIONS} onChange={onChange} />
    );
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "a");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("a");
  });
});
