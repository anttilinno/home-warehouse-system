import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { Trans } from "@lingui/react/macro";
import { formatCents } from "@/lib/utils/money";
import type { CategoryStats } from "@/features/analytics/types";
import { RetroChartFrame } from "../charts/RetroChartFrame";
import {
  seriesAt,
  markProps,
  AXIS_TICK_STYLE,
  CATEGORY_LABEL_STYLE,
  VALUE_LABEL_STYLE,
  GRID_PROPS,
  INK,
} from "../charts/retroChartTheme";

// ANL-01 — category inventory value as a horizontal bar, bars walking the
// ordered sketch-009 palette. Value axis is total_value (CENTS → formatCents).
export function CategoryValueChart({ data }: { data: CategoryStats[] }) {
  const isEmpty = data.length === 0;
  return (
    <RetroChartFrame
      title={<Trans>Category breakdown</Trans>}
      accent="blue"
      isEmpty={isEmpty}
      emptyLabel={<Trans>No category values for this range yet.</Trans>}
    >
      <BarChart layout="vertical" data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid {...GRID_PROPS} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatCents(v)}
          tick={AXIS_TICK_STYLE}
          axisLine={{ stroke: INK, strokeWidth: 2 }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={CATEGORY_LABEL_STYLE}
          axisLine={{ stroke: INK, strokeWidth: 2 }}
          tickLine={false}
        />
        <Bar dataKey="total_value" isAnimationActive={false}>
          {data.map((c, i) => (
            <Cell key={c.id} fill={seriesAt(i).fill} {...markProps} />
          ))}
          <LabelList
            dataKey="total_value"
            position="right"
            formatter={(v: unknown) => formatCents(Number(v))}
            style={VALUE_LABEL_STYLE}
          />
        </Bar>
      </BarChart>
    </RetroChartFrame>
  );
}
