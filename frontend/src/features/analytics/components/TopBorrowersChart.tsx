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
import { useChartColors } from "@/lib/useChartColors";
import type { TopBorrower } from "@/features/analytics/types";
import { RetroChartFrame } from "../charts/RetroChartFrame";
import {
  SERIES_BUTTER,
  markProps,
  axisLineProps,
  axisTickStyle,
  categoryLabelStyle,
  valueLabelStyle,
  gridProps,
  truncateLabel,
} from "../charts/retroChartTheme";

// ANL-02 — top borrowers ranked by total_loans, single-series butter (the
// loan/warning accent per sketch 009). A LabelList shows the loan count in the
// right gutter, clear of the bars.
export function TopBorrowersChart({ data }: Readonly<{ data: TopBorrower[] }>) {
  const { ink, grid, muted } = useChartColors();
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
        <CartesianGrid {...gridProps(grid)} horizontal={false} />
        <XAxis
          type="number"
          tick={axisTickStyle(muted)}
          axisLine={axisLineProps(ink)}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tickFormatter={(v: string) => truncateLabel(v, 11)}
          tick={categoryLabelStyle(ink)}
          axisLine={axisLineProps(ink)}
          tickLine={false}
        />
        <Bar dataKey="total_loans" isAnimationActive={false}>
          {data.map((b) => (
            <Cell key={b.id} fill={SERIES_BUTTER.fill} {...markProps(ink)} />
          ))}
          <LabelList
            dataKey="total_loans"
            position="right"
            style={valueLabelStyle(ink)}
          />
        </Bar>
      </BarChart>
    </RetroChartFrame>
  );
}
