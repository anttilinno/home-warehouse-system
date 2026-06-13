import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { AppearancePage } from "./AppearancePage";

// Phase 12 Plan 03 — AppearancePage (SETT-04 / SETT-11). Light-only: a single
// "Light" theme card marked CURRENT (selected treatment + badge + glyph) and a
// butter role="note" backlog band. NO dark option, NO toggle, NO write
// (presentational only — resolved OQ-R3). SETT-11 supersedes SETT-04's prose.

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <AppearancePage />
    </I18nProvider>,
  );
}

describe("AppearancePage (SETT-04 / SETT-11 light-only)", () => {
  it("renders exactly one Light theme card marked CURRENT", () => {
    renderPage();

    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("CURRENT")).toBeInTheDocument();
  });

  it("renders the butter backlog note with role='note'", () => {
    renderPage();

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(
      /light only — a dark theme is on the backlog\./i,
    );
  });

  it("has no dark theme option or toggle (presentational, no write)", () => {
    renderPage();

    // No interactive control for picking/toggling a theme.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    // The only "dark" mention is inside the backlog note (role=note), not a
    // selectable option labelled "Dark".
    const darkMentions = screen.queryAllByText(/^dark$/i);
    expect(darkMentions).toHaveLength(0);
  });
});
