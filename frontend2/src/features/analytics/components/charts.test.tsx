import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import type {
  CategoryStats,
  ConditionBreakdown,
  LocationInventoryValue,
  MonthlyLoanActivity,
  StatusBreakdown,
  TopBorrower,
} from "@/features/analytics/types";

// recharts ResponsiveContainer measures its parent with ResizeObserver and
// renders nothing until it has a non-zero box — in jsdom that box is always 0,
// so the chart SVG never paints. The standard recharts-in-jsdom pattern is to
// replace ResponsiveContainer with a fixed-size wrapper so the inner chart gets
// a concrete width/height and renders its marks.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 400 }}>
        <actual.ResponsiveContainer width={800} height={400}>
          {children as React.ReactElement}
        </actual.ResponsiveContainer>
      </div>
    ),
  };
});

import { CategoryValueChart } from "./CategoryValueChart";
import { LocationValueChart } from "./LocationValueChart";
import { ConditionDonutChart } from "./ConditionDonutChart";
import { StatusStackChart } from "./StatusStackChart";
import { TopBorrowersChart } from "./TopBorrowersChart";
import { MonthlyLoanActivityChart } from "./MonthlyLoanActivityChart";

function renderChart(ui: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

const categories: CategoryStats[] = [
  { id: "c1", name: "Power tools", item_count: 412, inventory_count: 500, total_value: 1894000 },
  { id: "c2", name: "Hand tools", item_count: 288, inventory_count: 300, total_value: 712000 },
  { id: "c3", name: "Cables / AV", item_count: 196, inventory_count: 210, total_value: 348000 },
];

const locations: LocationInventoryValue[] = [
  { id: "l1", name: "Garage", item_count: 120, total_quantity: 400, total_value: 1421000 },
  { id: "l2", name: "Workshop", item_count: 80, total_quantity: 260, total_value: 984000 },
];

const conditions: ConditionBreakdown[] = [
  { condition: "New", count: 295 },
  { condition: "Good", count: 238 },
  { condition: "Fair", count: 130 },
  { condition: "Poor", count: 57 },
];

const statuses: StatusBreakdown[] = [
  { status: "available", count: 540 },
  { status: "on_loan", count: 108 },
  { status: "maintenance", count: 48 },
  { status: "retired", count: 24 },
];

const borrowers: TopBorrower[] = [
  { id: "b1", name: "Mart", total_loans: 46, active_loans: 4 },
  { id: "b2", name: "Kati", total_loans: 36, active_loans: 2 },
];

const months: MonthlyLoanActivity[] = [
  { month: "2026-01-01", loans_created: 18, loans_returned: 14 },
  { month: "2026-02-01", loans_created: 24, loans_returned: 19 },
  { month: "2026-03-01", loans_created: 21, loans_returned: 17 },
];

describe("CategoryValueChart", () => {
  it("renders its Window title and a labelled bar per category", () => {
    const { container } = renderChart(<CategoryValueChart data={categories} />);
    expect(screen.getByRole("heading", { name: /category/i })).toBeInTheDocument();
    expect(screen.getByText("Power tools")).toBeInTheDocument();
    expect(screen.getByText("Cables / AV")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders the empty state for an empty dataset", () => {
    renderChart(<CategoryValueChart data={[]} />);
    expect(screen.getByRole("heading", { name: /no data/i })).toBeInTheDocument();
  });
});

describe("LocationValueChart", () => {
  it("renders bars and formats CENTS as currency (not the raw integer)", () => {
    renderChart(<LocationValueChart data={locations} />);
    expect(screen.getByRole("heading", { name: /location/i })).toBeInTheDocument();
    expect(screen.getByText("Garage")).toBeInTheDocument();
    // 1421000 cents → €14,210.00 style currency string; the raw integer must
    // never leak to the axis/label.
    const raw = screen.queryByText((t) => t.includes("1421000"));
    expect(raw).toBeNull();
    const currency = screen.queryAllByText((t) => /14[.,\s]?210/.test(t));
    expect(currency.length).toBeGreaterThan(0);
  });

  it("renders the empty state for an empty dataset", () => {
    renderChart(<LocationValueChart data={[]} />);
    expect(screen.getByRole("heading", { name: /no data/i })).toBeInTheDocument();
  });
});

describe("ConditionDonutChart", () => {
  it("renders a donut and a swatch legend per condition", () => {
    const { container } = renderChart(<ConditionDonutChart data={conditions} />);
    expect(screen.getByRole("heading", { name: /condition/i })).toBeInTheDocument();
    const legend = screen.getByTestId("condition-legend");
    expect(within(legend).getByText("New")).toBeInTheDocument();
    expect(within(legend).getByText("Poor")).toBeInTheDocument();
    // one <Cell> per condition → recharts paints path/sector marks
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });

  it("renders the empty state for an empty dataset", () => {
    renderChart(<ConditionDonutChart data={[]} />);
    expect(screen.getByRole("heading", { name: /no data/i })).toBeInTheDocument();
  });
});

describe("StatusStackChart", () => {
  it("renders a 100%-stacked bar with a segment per status", () => {
    renderChart(<StatusStackChart data={statuses} />);
    expect(screen.getByRole("heading", { name: /status/i })).toBeInTheDocument();
    const legend = screen.getByTestId("status-legend");
    expect(within(legend).getByText(/available/i)).toBeInTheDocument();
    expect(within(legend).getByText(/retired/i)).toBeInTheDocument();
  });

  it("renders the empty state for an empty dataset", () => {
    renderChart(<StatusStackChart data={[]} />);
    expect(screen.getByRole("heading", { name: /no data/i })).toBeInTheDocument();
  });
});

describe("TopBorrowersChart", () => {
  it("renders a bar per borrower", () => {
    const { container } = renderChart(<TopBorrowersChart data={borrowers} />);
    expect(screen.getByRole("heading", { name: /borrower/i })).toBeInTheDocument();
    expect(screen.getByText("Mart")).toBeInTheDocument();
    expect(screen.getByText("Kati")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders the empty state for an empty dataset", () => {
    renderChart(<TopBorrowersChart data={[]} />);
    expect(screen.getByRole("heading", { name: /no data/i })).toBeInTheDocument();
  });
});

describe("MonthlyLoanActivityChart", () => {
  it("renders an area + line over months", () => {
    const { container } = renderChart(<MonthlyLoanActivityChart data={months} />);
    expect(screen.getByRole("heading", { name: /monthly/i })).toBeInTheDocument();
    const legend = screen.getByTestId("monthly-legend");
    expect(within(legend).getByText(/loans out/i)).toBeInTheDocument();
    expect(within(legend).getByText(/returns/i)).toBeInTheDocument();
    // both series paint at least one path
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });

  it("renders the empty state for an empty dataset", () => {
    renderChart(<MonthlyLoanActivityChart data={[]} />);
    expect(screen.getByRole("heading", { name: /no data/i })).toBeInTheDocument();
  });
});
