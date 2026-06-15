import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { Trans } from "@lingui/react/macro";
import {
  Window,
  RetroEmptyState,
  type TitlebarVariant,
} from "@/components/retro";

export interface RetroChartFrameProps {
  /** Silkscreen panel title (rendered in the Window titlebar). */
  title: ReactNode;
  /** Semantic title-bar accent. Single-series charts take their accent here. */
  accent?: TitlebarVariant;
  /** When true, render the retro empty state instead of the chart. */
  isEmpty?: boolean;
  /** Empty-state body copy (one sentence; wrap in <Trans> at the call site). */
  emptyLabel?: ReactNode;
  /** Right-aligned titlebar meta slot (optional). */
  actions?: ReactNode;
  /** Fixed plot height so the responsive stack stays stable. Default 220. */
  height?: number;
  /** The recharts chart element (hosted inside a ResponsiveContainer). */
  children: ReactNode;
}

// The shared retro Window wrapper every chart composes. Renders a locked retro
// Window (2px ink border, bevel, pinstriped pastel title bar with a Silkscreen
// title) and, inside the body, either a ResponsiveContainer hosting the chart
// OR — when the dataset is empty — a RetroEmptyState. This is what makes "each
// chart in a locked retro Window" DRY across all six chart components.
export function RetroChartFrame({
  title,
  accent = "blue",
  isEmpty = false,
  emptyLabel,
  actions,
  height = 220,
  children,
}: RetroChartFrameProps) {
  return (
    <Window title={title} titlebarVariant={accent} actions={actions}>
      {isEmpty ? (
        <RetroEmptyState
          glyph="▤"
          heading={<Trans>No data</Trans>}
          body={
            emptyLabel ?? <Trans>Nothing to chart for this range yet.</Trans>
          }
        />
      ) : (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            {/* recharts expects a single chart element child here. */}
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </Window>
  );
}
