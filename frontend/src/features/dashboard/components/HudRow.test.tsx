import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import type { DashboardStats } from "@/lib/types";
import { HudRow } from "./HudRow";

// Phase 13 Plan 04 — DASH-04. The HUD row is flag-gated on
// VITE_FEATURE_HUD_ROLLUPS === "true" (DEFAULT OFF, mirrors the SocialLogin
// Authelia precedent). Flag off → renders null. Flag on → hand-rolled SVG
// gauge + 14-day sparkline + counts, with the sparkline honestly "data
// pending" (no backend series exists yet).

const STATS: DashboardStats = {
  total_items: 42,
  total_inventory: 137,
  total_locations: 8,
  total_containers: 19,
  active_loans: 5,
  overdue_loans: 1,
  low_stock_items: 3,
  total_categories: 11,
  total_borrowers: 7,
};

function renderHud(stats?: DashboardStats) {
  return render(
    <I18nProvider i18n={i18n}>
      <HudRow stats={stats} />
    </I18nProvider>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HudRow", () => {
  it("renders NOTHING when the flag is unset (default off)", () => {
    const { container } = renderHud(STATS);
    expect(container.firstChild).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders NOTHING when the flag is 'false'", () => {
    vi.stubEnv("VITE_FEATURE_HUD_ROLLUPS", "false");
    const { container } = renderHud(STATS);
    expect(container.firstChild).toBeNull();
  });

  it("renders an SVG gauge AND a sparkline when the flag is 'true'", () => {
    vi.stubEnv("VITE_FEATURE_HUD_ROLLUPS", "true");
    const { container, getByTestId } = renderHud(STATS);
    // Gauge: a hand-rolled <svg>.
    const gauge = getByTestId("hud-capacity-gauge");
    expect(gauge.tagName.toLowerCase()).toBe("svg");
    // Sparkline: a separate hand-rolled <svg>.
    const sparkline = getByTestId("hud-activity-sparkline");
    expect(sparkline.tagName.toLowerCase()).toBe("svg");
    // At least two svgs are present overall.
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("renders the counts from DashboardStats when enabled", () => {
    vi.stubEnv("VITE_FEATURE_HUD_ROLLUPS", "true");
    const { getByText } = renderHud(STATS);
    expect(getByText("42")).toBeInTheDocument(); // total_items
    expect(getByText("5")).toBeInTheDocument(); // active_loans
    expect(getByText("3")).toBeInTheDocument(); // low_stock_items
  });

  it("shows a 'data pending' treatment for the empty 14-day sparkline (no fabricated series)", () => {
    vi.stubEnv("VITE_FEATURE_HUD_ROLLUPS", "true");
    const { getAllByText, getByTestId } = renderHud(STATS);
    // The sparkline carries no real points — a placeholder baseline, not data.
    const sparkline = getByTestId("hud-activity-sparkline");
    expect(sparkline.querySelector("polyline")).toBeNull();
    // The "data pending" caption is shown (both gauge target + sparkline are
    // honestly stubbed, so the caption may appear more than once).
    expect(getAllByText(/data pending/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders enabled even when stats is undefined (counts fall back to —)", () => {
    vi.stubEnv("VITE_FEATURE_HUD_ROLLUPS", "true");
    const { getByTestId } = renderHud(undefined);
    expect(getByTestId("hud-capacity-gauge")).toBeInTheDocument();
  });
});
