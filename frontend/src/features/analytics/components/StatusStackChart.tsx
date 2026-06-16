import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { Trans } from "@lingui/react/macro";
import type { StatusBreakdown } from "@/features/analytics/types";
import { Window, RetroEmptyState } from "@/components/retro";
import { useChartColors } from "@/lib/useChartColors";
import { seriesAt, markProps } from "../charts/retroChartTheme";

// ANL-01 — status distribution as a single 100%-STACKED horizontal bar. Each
// status count is normalized to its share of the total; the segments stack
// across one row, palette-walked + ink-stroked. A swatch legend names each
// status with its raw count. NO default recharts tooltip skin.
export function StatusStackChart({ data }: Readonly<{ data: StatusBreakdown[] }>) {
  const { ink } = useChartColors();
  const isEmpty = data.length === 0;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  // recharts stacks numeric series keyed by dataKey on a single datum row.
  // Build one row whose keys are the status names, each value = its share (%).
  const row: Record<string, number> = { name: 0 };
  if (total > 0) {
    for (const d of data) row[d.status] = (d.count / total) * 100;
  }

  return (
    <Window title={<Trans>Status mix</Trans>} titlebarVariant="blue">
      {isEmpty ? (
        <RetroEmptyState
          glyph="▤"
          heading={<Trans>No data</Trans>}
          body={<Trans>No status data for this range yet.</Trans>}
        />
      ) : (
        <div className="flex flex-col gap-sp-3">
          <div style={{ width: "100%", height: 56 }}>
            <BarChart
              layout="vertical"
              width={520}
              height={56}
              data={[row]}
              stackOffset="expand"
              margin={{ top: 6, right: 8, bottom: 6, left: 8 }}
            >
              <XAxis type="number" hide domain={[0, 100]} />
              <YAxis type="category" dataKey="name" hide />
              {data.map((d, i) => (
                <Bar
                  key={d.status}
                  dataKey={d.status}
                  stackId="status"
                  fill={seriesAt(i).fill}
                  isAnimationActive={false}
                  {...markProps(ink)}
                />
              ))}
            </BarChart>
          </div>
          <ul
            data-testid="status-legend"
            className="flex flex-wrap gap-sp-2 gap-x-sp-4 text-12 font-semibold"
          >
            {data.map((d, i) => (
              <li key={d.status} className="flex items-center gap-sp-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-[14px] w-[14px] flex-none border-2 border-border-ink"
                  style={{ background: seriesAt(i).fill }}
                />
                <span>{d.status}</span>
                <span className="ml-1 font-mono text-fg-muted tabular-nums">
                  {d.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Window>
  );
}
