import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { FilterPopover } from "./FilterPopover";

function wrap(ui: React.ReactNode) {
  return (
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>{ui}</ModalStackProvider>
    </I18nProvider>
  );
}

const OPTIONS = [
  { value: "tools", label: "Tools" },
  { value: "consumables", label: "Consumables" },
];

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("FilterPopover", () => {
  it("a facet trigger opens the Popover with a RetroCheckbox checklist of facet values", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <FilterPopover
          label="Category"
          options={OPTIONS}
          selected={[]}
          onChange={vi.fn()}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: /category/i }));
    expect(
      await screen.findByRole("checkbox", { name: "Tools" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Consumables" }),
    ).toBeInTheDocument();
  });

  it("toggling a checkbox keeps the popover open and calls onChange with the next selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      wrap(
        <FilterPopover
          label="Category"
          options={OPTIONS}
          selected={[]}
          onChange={onChange}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: /category/i }));
    await user.click(await screen.findByRole("checkbox", { name: "Tools" }));

    expect(onChange).toHaveBeenCalledWith(["tools"]);
    // The popover stays open after a toggle (multi-select).
    expect(screen.getByRole("checkbox", { name: "Consumables" })).toBeInTheDocument();
  });

  it("Escape closes via the modal stack (no local document ESC listener)", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <FilterPopover
          label="Category"
          options={OPTIONS}
          selected={[]}
          onChange={vi.fn()}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: /category/i }));
    expect(await screen.findByRole("checkbox", { name: "Tools" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("checkbox", { name: "Tools" })).not.toBeInTheDocument();
  });
});
