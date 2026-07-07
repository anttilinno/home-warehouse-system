import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Trans } from "@lingui/react/macro";
import { formatMonthYearToken } from "@/lib/format";
import type { MonthlyLoanActivity } from "@/features/analytics/types";
import { Window, RetroEmptyState } from "@/components/retro";
import { useChartColors } from "@/lib/useChartColors";
import {
  SERIES_BLUE,
  SERIES_MINT,
  STROKE_WIDTH,
  axisLineProps,
  axisTickStyle,
  gridProps,
} from "../charts/retroChartTheme";

// Format an ISO-ish month string to a "YYYY-MM" tick (mono, tabular). I18N-03:
// `monthTick` is passed as Recharts' <XAxis tickFormatter> — Recharts invokes it
// OUTSIDE React's hook call stack, so it CANNOT call useDateFormat() (Rules of
// Hooks). It uses the PURE formatMonthYearToken helper instead of a raw locale call.
function monthTick(value: string): string {
  return formatMonthYearToken(value);
}

// Square ink-stroked marker for the returns line (sketch-009 data points).
// `ink` is threaded from useChartColors (recharts clones this element with
// cx/cy, preserving the ink prop) so the stroke flips with the theme.
function SquareDot(
  props: Readonly<{ cx?: number; cy?: number; ink?: string }>,
) {
  const { cx, cy, ink } = props;
  if (cx == null || cy == null) return null;
  return (
    <rect
      x={cx - 4}
      y={cy - 4}
      width={8}
      height={8}
      fill={SERIES_MINT.fill}
      stroke={ink ?? "#26262e"}
      strokeWidth={2}
    />
  );
}

// ANL-02 — monthly loan activity: an AREA (loans_created, blue fill + 2px ink
// top stroke) layered with a LINE (loans_returned, mint stroke + square
// ink-stroked markers) over the months. Full-width panel, blue accent. A custom
// retro swatch legend names the two series.
export function MonthlyLoanActivityChart({
  data,
}: Readonly<{
  data: MonthlyLoanActivity[];
}>) {
  const { ink, grid, muted } = useChartColors();
  const isEmpty = data.length === 0;

  return (
    <Window title={<Trans>Monthly loan activity</Trans>} titlebarVariant="blue">
      {isEmpty ? (
        <RetroEmptyState
          glyph="chart-bar-big"
          heading={<Trans>No data</Trans>}
          body={<Trans>No loan activity for this range yet.</Trans>}
        />
      ) : (
        <div className="flex flex-col gap-sp-2">
          <ul
            data-testid="monthly-legend"
            className="flex gap-sp-4 text-12 font-semibold"
          >
            <li className="flex items-center gap-sp-2">
              <span
                aria-hidden="true"
                className="inline-block h-[14px] w-[14px] flex-none border-2 border-border-ink"
                style={{ background: SERIES_BLUE.fill }}
              />
              <Trans>Loans out</Trans>
            </li>
            <li className="flex items-center gap-sp-2">
              <span
                aria-hidden="true"
                className="inline-block h-[14px] w-[14px] flex-none border-2 border-border-ink"
                style={{ background: SERIES_MINT.fill }}
              />
              <Trans>Returns</Trans>
            </li>
          </ul>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart
              data={data}
              margin={{ top: 12, right: 24, bottom: 8, left: 8 }}
            >
              <CartesianGrid {...gridProps(grid)} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthTick}
                tick={axisTickStyle(muted)}
                axisLine={axisLineProps(ink)}
                tickLine={false}
              />
              <YAxis
                tick={axisTickStyle(muted)}
                axisLine={axisLineProps(ink)}
                tickLine={false}
                allowDecimals={false}
              />
              <Area
                type="linear"
                dataKey="loans_created"
                fill={SERIES_BLUE.fill}
                fillOpacity={0.85}
                stroke={ink}
                strokeWidth={STROKE_WIDTH}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="loans_returned"
                stroke={SERIES_MINT.fill}
                strokeWidth={4}
                isAnimationActive={false}
                dot={<SquareDot ink={ink} />}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Window>
  );
}
