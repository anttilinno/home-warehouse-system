import { beforeAll, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { OutOfStockTable } from "./OutOfStockTable";

// 13b-01 (same-wave sibling) owns features/analytics/types.ts and exports
// OutOfStockItem. On THIS branch that module does not exist yet (the typed
// import seam resolves on merge), so the test declares a local fixture shape
// that mirrors the verified OutOfStockItem contract used by the component:
// { id, name, sku, min_stock_level, category_id?, category_name? }.
type Fixture = {
  id: string;
  name: string;
  sku: string;
  min_stock_level: number;
  category_id?: string;
  category_name?: string;
};

const FIXTURES: Fixture[] = [
  {
    id: "itm-1",
    name: "M3 Hex Bolts",
    sku: "BOLT-M3-100",
    min_stock_level: 50,
    category_id: "cat-1",
    category_name: "Fasteners",
  },
  {
    id: "itm-2",
    name: "Cable Ties",
    sku: "TIE-200MM",
    min_stock_level: 25,
    // no category_name → muted "—"
  },
];

function renderTable(props: { items: Fixture[]; isLoading?: boolean }) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nProvider>
  );
  // Cast: the component types `items` as the (merge-time) OutOfStockItem; the
  // local Fixture is structurally identical to the verified contract.
  return render(
    <OutOfStockTable
      items={props.items as never}
      isLoading={props.isLoading}
    />,
    { wrapper },
  );
}

describe("OutOfStockTable", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders one row per item with the name linking to /items/{id}", () => {
    renderTable({ items: FIXTURES });

    const link1 = screen.getByRole("link", { name: "M3 Hex Bolts" });
    expect(link1.getAttribute("href")).toMatch(/\/items\/itm-1$/);

    const link2 = screen.getByRole("link", { name: "Cable Ties" });
    expect(link2.getAttribute("href")).toMatch(/\/items\/itm-2$/);
  });

  it("shows min_stock_level and a danger-mono current-stock 0 per row", () => {
    renderTable({ items: FIXTURES });

    const row = screen
      .getByRole("link", { name: "M3 Hex Bolts" })
      .closest("tr")!;
    // min_stock_level value present in the row.
    expect(within(row).getByText("50")).toBeInTheDocument();
    // current stock renders an honest literal "0" carrying the danger/mono class.
    const zero = within(row).getByText("0");
    expect(zero.className).toContain("text-danger");
    expect(zero.className).toContain("mono");
  });

  it("carries an OUT badge on every row", () => {
    renderTable({ items: FIXTURES });

    const badges = screen.getAllByText("OUT");
    expect(badges).toHaveLength(FIXTURES.length);
  });

  it("renders category_name when present and a muted — when absent", () => {
    renderTable({ items: FIXTURES });

    const withCat = screen
      .getByRole("link", { name: "M3 Hex Bolts" })
      .closest("tr")!;
    expect(within(withCat).getByText("Fasteners")).toBeInTheDocument();

    const withoutCat = screen
      .getByRole("link", { name: "Cable Ties" })
      .closest("tr")!;
    expect(within(withoutCat).getByText("—")).toBeInTheDocument();
  });

  it("renders a RetroEmptyState (and no rows) for an empty items array", () => {
    renderTable({ items: [] });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("row")).not.toBeInTheDocument();
    // empty-state copy.
    expect(screen.getByText(/all items are in stock/i)).toBeInTheDocument();
  });

  it("renders a loading line and no table while isLoading", () => {
    renderTable({ items: [], isLoading: true });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByRole("row")).not.toBeInTheDocument();
  });
});
