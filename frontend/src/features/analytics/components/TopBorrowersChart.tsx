import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import { Trans } from "@lingui/react/macro";
import type { TopBorrower } from "@/features/analytics/types";
import { RetroChartFrame } from "../charts/RetroChartFrame";
import {
  SERIES_BUTTER,
  markProps,
  AXIS_TICK_STYLE,
  CATEGORY_LABEL_STYLE,
  VALUE_LABEL_STYLE,
  GRID_PROPS,
  INK,
  truncateLabel,
} from "../charts/retroChartTheme";

// ANL-02 — top borrowers ranked by total_loans, single-series butter (the
// loan/warning accent per sketch 009). A LabelList shows the loan count in the
// right gutter, clear of the bars.
export function TopBorrowersChart({ data }: { data: TopBorrower[] }) {
  const isEmpty = data.length === 0;
  return (
    <RetroChartFrame
      title={<Trans>Top borrowers</Trans>}
      accent="butter"
      isEmpty={isEmpty}
      emptyLabel={<Trans>No borrower activity for this range yet.</Trans>}
    >
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
      >
        <CartesianGrid {...GRID_PROPS} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS_TICK_STYLE}
          axisLine={{ stroke: INK, strokeWidth: 2 }}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tickFormatter={(v: string) => truncateLabel(v, 11)}
          tick={CATEGORY_LABEL_STYLE}
          axisLine={{ stroke: INK, strokeWidth: 2 }}
          tickLine={false}
        />
        <Bar dataKey="total_loans" isAnimationActive={false}>
          {data.map((b) => (
            <Cell key={b.id} fill={SERIES_BUTTER.fill} {...markProps} />
          ))}
          <LabelList
            dataKey="total_loans"
            position="right"
            style={VALUE_LABEL_STYLE}
          />
        </Bar>
      </BarChart>
    </RetroChartFrame>
  );
}
