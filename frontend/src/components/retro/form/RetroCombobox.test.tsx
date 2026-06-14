import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { useEffect, useState } from "react";
import { RetroCombobox } from "./RetroCombobox";

const OPTIONS = [
  { value: "apple", label: "Apple" },
  { value: "apricot", label: "Apricot" },
  { value: "banana", label: "Banana" },
];

function LogoutOnEscape({ onLogout }: { onLogout: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onLogout();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onLogout]);
  return null;
}

function Host({
  initialValue = "",
  onLogout,
  onChange,
}: {
  initialValue?: string;
  onLogout?: () => void;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>
        {onLogout && <LogoutOnEscape onLogout={onLogout} />}
        <RetroCombobox
          label="Fruit"
          options={OPTIONS}
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange?.(v);
          }}
        />
      </ModalStackProvider>
    </I18nProvider>
  );
}

describe("RetroCombobox", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("wires combobox ARIA on the input and a listbox of options when open", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("filters the options as the user types", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "ap");
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining(["Apple", "Apricot"]),
    );
    expect(options).toHaveLength(2);
  });

  it("ArrowDown moves aria-activedescendant WITHOUT moving DOM focus off the input", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    const active1 = input.getAttribute("aria-activedescendant");
    expect(active1).toBeTruthy();
    // DOM focus stays on the input (virtual focus).
    expect(document.activeElement).toBe(input);
    await user.keyboard("{ArrowDown}");
    const active2 = input.getAttribute("aria-activedescendant");
    expect(active2).not.toBe(active1);
    expect(document.activeElement).toBe(input);
    // The active descendant id matches a rendered option.
    expect(document.getElementById(active2!)).toHaveAttribute("role", "option");
  });

  it("Enter commits the active option, closes the listbox, sets the input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("{ArrowDown}"); // Apple
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("apple");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input.value).toBe("Apple");
  });

  it("Escape closes the listbox via the modal stack and does NOT log out", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<Host onLogout={onLogout} />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("renders a single muted 'No matches.' row when the filter matches nothing", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });

  it("marks the selected option with a ✓ glyph", async () => {
    const user = userEvent.setup();
    render(<Host initialValue="banana" />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    const banana = screen
      .getAllByRole("option")
      .find((o) => o.textContent?.includes("Banana"))!;
    expect(banana).toHaveAttribute("aria-selected", "true");
    expect(banana.textContent).toContain("✓");
  });
});
