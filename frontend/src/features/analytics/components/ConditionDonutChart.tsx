import { PieChart, Pie, Cell } from "recharts";
import { Trans } from "@lingui/react/macro";
import type { ConditionBreakdown } from "@/features/analytics/types";
import { Window, RetroEmptyState } from "@/components/retro";
import { useChartColors } from "@/lib/useChartColors";
import { seriesAt, markProps } from "../charts/retroChartTheme";

// ANL-01 — condition distribution as a retro donut. Slices walk the ordered
// sketch-009 palette; an explicit swatch legend names each condition (ink
// border + pastel swatch + mono count). The PieChart is rendered at a fixed box
// (it sits beside the legend, so it does not use the full-width responsive
// frame). NO default recharts tooltip skin.
export function ConditionDonutChart({
  data,
}: Readonly<{ data: ConditionBreakdown[] }>) {
  const { ink } = useChartColors();
  const isEmpty = data.length === 0;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Window title={<Trans>Condition + Status</Trans>} titlebarVariant="blue">
      {isEmpty ? (
        <RetroEmptyState
          glyph="▤"
          heading={<Trans>No data</Trans>}
          body={<Trans>No condition data for this range yet.</Trans>}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-sp-5">
          <PieChart width={160} height={160}>
            <Pie
              data={data}
              dataKey="count"
              nameKey="condition"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={62}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell
                  key={d.condition}
                  fill={seriesAt(i).fill}
                  {...markProps(ink)}
                />
              ))}
            </Pie>
          </PieChart>
          <ul
            data-testid="condition-legend"
            className="flex flex-col gap-[6px] text-12 font-semibold"
          >
            {data.map((d, i) => (
              <li key={d.condition} className="flex items-center gap-sp-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-[14px] w-[14px] flex-none border-2 border-border-ink"
                  style={{ background: seriesAt(i).fill }}
                />
                <span>{d.condition}</span>
                <span className="ml-1 font-mono text-fg-muted tabular-nums">
                  {d.count}
                </span>
              </li>
            ))}
            <li className="mt-sp-1 border-t-2 border-border-ink pt-sp-1 font-mono text-fg-muted tabular-nums">
              <Trans>Total</Trans> {total}
            </li>
          </ul>
        </div>
      )}
    </Window>
  );
}
