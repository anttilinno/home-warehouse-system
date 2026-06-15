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
import { formatCents } from "@/lib/utils/money";
import type { LocationInventoryValue } from "@/features/analytics/types";
import { RetroChartFrame } from "../charts/RetroChartFrame";
import {
  SERIES_MINT,
  markProps,
  AXIS_TICK_STYLE,
  CATEGORY_LABEL_STYLE,
  VALUE_LABEL_STYLE,
  GRID_PROPS,
  INK,
  truncateLabel,
} from "../charts/retroChartTheme";

// ANL-01 — location inventory value as a single-series horizontal bar. Per the
// sketch-009 single-series rule, the whole series takes the title-bar's mint
// accent. Value = total_value (CENTS → formatCents).
export function LocationValueChart({
  data,
}: {
  data: LocationInventoryValue[];
}) {
  const isEmpty = data.length === 0;
  return (
    <RetroChartFrame
      title={<Trans>Location value</Trans>}
      accent="mint"
      isEmpty={isEmpty}
      emptyLabel={<Trans>No location values for this range yet.</Trans>}
    >
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
      >
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
          tickFormatter={(v: string) => truncateLabel(v, 14)}
          tick={CATEGORY_LABEL_STYLE}
          axisLine={{ stroke: INK, strokeWidth: 2 }}
          tickLine={false}
        />
        <Bar dataKey="total_value" isAnimationActive={false}>
          {data.map((l) => (
            <Cell key={l.id} fill={SERIES_MINT.fill} {...markProps} />
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
