import { Trans, useLingui } from "@lingui/react/macro";
import type { DashboardStats } from "@/lib/types";
import { Window } from "@/components/retro";

// Phase 13 Plan 04 — DASH-04: the flag-gated HUD row.
//
// FLAG: gated on `import.meta.env.VITE_FEATURE_HUD_ROLLUPS === "true"`,
//   DEFAULT OFF (mirrors the SocialLoginButtons Authelia precedent). With the
//   flag unset/false this component renders null, so the dashboard is identical
//   to today. Plan 13-05 mounts <HudRow> unconditionally; the gate lives HERE.
//
// NO CHARTING LIBRARY (POL-04 bundle budget; charting is Phase 13b). The gauge
// and sparkline are hand-rolled <svg> with computed coordinate math — no
// recharts / chart.js / d3 / visx import.
//
// BACKEND-COORDINATION GAPS (carry-forward — VALIDATION-confirmed, do NOT
// fabricate data or invent endpoints this phase):
//   1. capacity_target — the backend exposes NO capacity target. The gauge fills
//      against CAPACITY_TARGET_PLACEHOLDER (a labelled client constant) and
//      carries a "data pending" caption so it reads as honestly stubbed.
//   2. /activity?days=14 — `/analytics/activity` accepts `limit` only; there is
//      NO 14-day aggregate series. The sparkline therefore renders an empty
//      dashed baseline with a "data pending" caption rather than a fabricated
//      line. The seam for a future series is the `series` field (left []).

// Client placeholder until the backend ships a real capacity target (gap #1).
const CAPACITY_TARGET_PLACEHOLDER = 500;

// Sparkline viewbox geometry (hand-rolled — no charting lib).
const SPARK_W = 120;
const SPARK_H = 32;

// Gauge geometry: a 270° donut arc (hand-rolled SVG path math).
const GAUGE_SIZE = 96;
const GAUGE_R = 38;
const GAUGE_CX = GAUGE_SIZE / 2;
const GAUGE_CY = GAUGE_SIZE / 2;
const GAUGE_START_DEG = 135; // sweep from 135° clockwise through 405° (270° arc)
const GAUGE_SWEEP_DEG = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// An SVG arc path string from startDeg sweeping `sweepDeg` clockwise.
function arcPath(r: number, startDeg: number, sweepDeg: number): string {
  const start = polar(GAUGE_CX, GAUGE_CY, r, startDeg);
  const end = polar(GAUGE_CX, GAUGE_CY, r, startDeg + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export interface HudRowProps {
  stats?: DashboardStats;
}

export function HudRow({ stats }: HudRowProps) {
  const { t } = useLingui();

  // Build-time flag gate — default off (gap-honest HUD ships hidden).
  const enabled = import.meta.env.VITE_FEATURE_HUD_ROLLUPS === "true";
  if (!enabled) return null;

  // Capacity fill ratio against the client placeholder target (gap #1).
  const used = stats?.total_inventory ?? 0;
  const ratio = Math.max(0, Math.min(1, used / CAPACITY_TARGET_PLACEHOLDER));
  const trackPath = arcPath(GAUGE_R, GAUGE_START_DEG, GAUGE_SWEEP_DEG);
  const fillPath = arcPath(GAUGE_R, GAUGE_START_DEG, GAUGE_SWEEP_DEG * ratio);

  // 14-day series — NO backend aggregate exists (gap #2). Empty by design.
  const series: number[] = [];
  const hasSeries = series.length > 0;

  const counts: Array<[string, number | undefined]> = [
    [t`Items`, stats?.total_items],
    [t`Active loans`, stats?.active_loans],
    [t`Low stock`, stats?.low_stock_items],
  ];

  return (
    <Window
      title={<Trans>System rollups</Trans>}
      titlebarVariant="mint"
      actions={<span className="font-mono text-11">HUD</span>}
    >
      <div className="grid grid-cols-1 gap-sp-4 md:grid-cols-3 [&>*]:min-w-0">
        {/* (1) Capacity gauge — hand-rolled SVG donut arc. */}
        <div className="flex flex-col items-center gap-sp-1 border-2 border-border-ink bg-bg-panel px-sp-3 py-sp-3 bevel-raised-ink">
          <svg
            data-testid="hud-capacity-gauge"
            role="img"
            aria-label={t`Capacity gauge`}
            viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
            className="h-[96px] w-[96px]"
          >
            <path
              d={trackPath}
              fill="none"
              stroke="var(--color-border-ink)"
              strokeOpacity={0.18}
              strokeWidth={9}
              strokeLinecap="round"
            />
            <path
              d={fillPath}
              fill="none"
              stroke="var(--color-titlebar-mint)"
              strokeWidth={9}
              strokeLinecap="round"
            />
            <text
              x={GAUGE_CX}
              y={GAUGE_CY + 4}
              textAnchor="middle"
              className="fill-fg-ink font-display text-16"
            >
              {used}
            </text>
          </svg>
          <span className="text-11 font-semibold uppercase tracking-6 text-fg-muted">
            <Trans>Capacity</Trans>
          </span>
          <span className="font-mono text-10 text-fg-muted">
            {/* Target is a client placeholder — honestly flagged (gap #1). */}
            <Trans>target {CAPACITY_TARGET_PLACEHOLDER} · data pending</Trans>
          </span>
        </div>

        {/* (2) 14-day activity sparkline — hand-rolled SVG, empty baseline. */}
        <div className="flex flex-col items-center justify-center gap-sp-2 border-2 border-border-ink bg-bg-panel px-sp-3 py-sp-3 bevel-raised-ink">
          <svg
            data-testid="hud-activity-sparkline"
            role="img"
            aria-label={t`14-day activity`}
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
            preserveAspectRatio="none"
            className="h-[32px] w-full"
          >
            {hasSeries ? (
              // Seam for a future client-derivable series (currently never hit).
              <polyline
                fill="none"
                stroke="var(--color-titlebar-blue)"
                strokeWidth={1.5}
                points={series
                  .map((v, i) => {
                    const max = Math.max(...series, 1);
                    const x = (i / (series.length - 1 || 1)) * SPARK_W;
                    const y = SPARK_H - (v / max) * SPARK_H;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(" ")}
              />
            ) : (
              // No backend 14-day aggregate → dashed flat baseline, NOT data.
              <line
                x1={0}
                y1={SPARK_H / 2}
                x2={SPARK_W}
                y2={SPARK_H / 2}
                stroke="var(--color-border-ink)"
                strokeOpacity={0.4}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}
          </svg>
          <span className="text-11 font-semibold uppercase tracking-6 text-fg-muted">
            <Trans>14-day activity</Trans>
          </span>
          <span className="font-mono text-10 text-fg-muted">
            <Trans>data pending</Trans>
          </span>
        </div>

        {/* (3) Counts — key DashboardStats figures as mono numbers. */}
        <div className="flex flex-col justify-center gap-sp-2 border-2 border-border-ink bg-bg-panel px-sp-3 py-sp-3 bevel-raised-ink">
          {counts.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-sp-2 text-12 font-semibold uppercase tracking-6 text-fg-muted"
            >
              {label}
              <b className="font-display text-16 text-fg-ink">{value ?? "—"}</b>
            </div>
          ))}
        </div>
      </div>
    </Window>
  );
}
