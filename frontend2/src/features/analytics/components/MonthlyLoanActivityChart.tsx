import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Trans } from "@lingui/react/macro";
import { formatMonthYearToken } from "@/lib/format";
import type { MonthlyLoanActivity } from "@/features/analytics/types";
import { Window, RetroEmptyState } from "@/components/retro";
import {
  SERIES_BLUE,
  SERIES_MINT,
  INK,
  STROKE_WIDTH,
  AXIS_TICK_STYLE,
  GRID_PROPS,
} from "../charts/retroChartTheme";

// Format an ISO-ish month string to a "YYYY-MM" tick (mono, tabular). I18N-03:
// `monthTick` is passed as Recharts' <XAxis tickFormatter> — Recharts invokes it
// OUTSIDE React's hook call stack, so it CANNOT call useDateFormat() (Rules of
// Hooks). It uses the PURE formatMonthYearToken helper instead of a raw locale call.
function monthTick(value: string): string {
  return formatMonthYearToken(value);
}

// Square ink-stroked marker for the returns line (sketch-009 data points).
function SquareDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <rect
      x={cx - 4}
      y={cy - 4}
      width={8}
      height={8}
      fill={SERIES_MINT.fill}
      stroke={INK}
      strokeWidth={2}
    />
  );
}

// ANL-02 — monthly loan activity: an AREA (loans_created, blue fill + 2px ink
// top stroke) layered with a LINE (loans_returned, mint stroke + square
// ink-stroked markers) over the months. Full-width panel, blue accent. A custom
// retro swatch legend names the two series.
export function MonthlyLoanActivityChart({ data }: { data: MonthlyLoanActivity[] }) {
  const isEmpty = data.length === 0;

  return (
    <Window title={<Trans>Monthly loan activity</Trans>} titlebarVariant="blue">
      {isEmpty ? (
        <RetroEmptyState
          glyph="▤"
          heading={<Trans>No data</Trans>}
          body={<Trans>No loan activity for this range yet.</Trans>}
        />
      ) : (
        <div className="flex flex-col gap-sp-2">
          <ul
            data-testid="monthly-legend"
            className="flex gap-sp-4 text-[12px] font-semibold"
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
          <div style={{ width: "100%", height: 260 }}>
            <ComposedChart
              width={1000}
              height={260}
              data={data}
              margin={{ top: 12, right: 24, bottom: 8, left: 8 }}
            >
              <CartesianGrid {...GRID_PROPS} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthTick}
                tick={AXIS_TICK_STYLE}
                axisLine={{ stroke: INK, strokeWidth: 2 }}
                tickLine={false}
              />
              <YAxis
                tick={AXIS_TICK_STYLE}
                axisLine={{ stroke: INK, strokeWidth: 2 }}
                tickLine={false}
                allowDecimals={false}
              />
              <Area
                type="linear"
                dataKey="loans_created"
                fill={SERIES_BLUE.fill}
                fillOpacity={0.85}
                stroke={INK}
                strokeWidth={STROKE_WIDTH}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="loans_returned"
                stroke={SERIES_MINT.fill}
                strokeWidth={4}
                isAnimationActive={false}
                dot={<SquareDot />}
              />
            </ComposedChart>
          </div>
        </div>
      )}
    </Window>
  );
}
