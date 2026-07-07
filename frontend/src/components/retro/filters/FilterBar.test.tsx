import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { FilterBar } from "./FilterBar";

function wrap(ui: React.ReactNode) {
  return <I18nProvider i18n={i18n}>{ui}</I18nProvider>;
}

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("FilterBar", () => {
  it("renders the search input, facet triggers, the {n} items count, and the primary CTA", () => {
    render(
      wrap(
        <FilterBar
          searchValue=""
          onSearchChange={vi.fn()}
          facets={[
            {
              key: "category",
              label: "Category",
              trigger: <button type="button">Category ▾</button>,
            },
            {
              key: "location",
              label: "Location",
              trigger: <button type="button">Location ▾</button>,
            },
          ]}
          itemCount={34}
          filterChips={[]}
          onRemoveFilter={vi.fn()}
          onClearAll={vi.fn()}
          primaryAction={<button type="button">+ ADD ITEM</button>}
        />,
      ),
    );

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /category/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /location/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("34 items")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /\+ add item/i }),
    ).toBeInTheDocument();
  });

  it("typing in search calls onSearchChange", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      wrap(
        <FilterBar
          searchValue=""
          onSearchChange={onSearchChange}
          facets={[]}
          itemCount={0}
          filterChips={[]}
          onRemoveFilter={vi.fn()}
          onClearAll={vi.fn()}
        />,
      ),
    );

    await user.type(screen.getByRole("searchbox"), "drill");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("active-filter chips render with an ink ✕ that calls onRemoveFilter; CLEAR ALL calls onClearAll", async () => {
    const user = userEvent.setup();
    const onRemoveFilter = vi.fn();
    const onClearAll = vi.fn();
    render(
      wrap(
        <FilterBar
          searchValue=""
          onSearchChange={vi.fn()}
          facets={[]}
          itemCount={5}
          filterChips={[
            { key: "category", label: "Category", displayValue: "Tools" },
          ]}
          onRemoveFilter={onRemoveFilter}
          onClearAll={onClearAll}
        />,
      ),
    );

    expect(screen.getByText("Tools")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /remove category filter/i }),
    );
    expect(onRemoveFilter).toHaveBeenCalledWith("category");

    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("shows CLEAR ALL for a search-only state (no chips), and hides it when fully idle", () => {
    const { rerender } = render(
      wrap(
        <FilterBar
          searchValue="drill"
          onSearchChange={vi.fn()}
          facets={[]}
          itemCount={2}
          filterChips={[]}
          onRemoveFilter={vi.fn()}
          onClearAll={vi.fn()}
        />,
      ),
    );
    // Search term carries no chip, but the reset affordance must still appear.
    expect(
      screen.getByRole("button", { name: /clear all/i }),
    ).toBeInTheDocument();

    rerender(
      wrap(
        <FilterBar
          searchValue=""
          onSearchChange={vi.fn()}
          facets={[]}
          itemCount={2}
          filterChips={[]}
          onRemoveFilter={vi.fn()}
          onClearAll={vi.fn()}
        />,
      ),
    );
    expect(
      screen.queryByRole("button", { name: /clear all/i }),
    ).not.toBeInTheDocument();
  });
});
