import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DemoPage } from "./DemoPage";

// Smoke render for the DEV-only dark-terminal dashboard mockup (the /demo
// colour-validation surface). It is self-contained — no providers, no i18n, no
// router — so a plain render proves it mounts and paints the key regions.
describe("DemoPage", () => {
  it("renders the terminal dashboard chrome", () => {
    render(<DemoPage />);
    expect(screen.getByText("WAREHOUSE.SYS")).toBeInTheDocument();
    expect(screen.getByText(/recent activity log/i)).toBeInTheDocument();
    expect(screen.getByText(/pending approvals/i)).toBeInTheDocument();
  });

  it("renders the four colored stat cards", () => {
    render(<DemoPage />);
    for (const label of [
      /item count/i,
      /active loans/i,
      /overstock/i,
      /low stock/i,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders the status badges in the activity log", () => {
    render(<DemoPage />);
    expect(screen.getAllByText("SUCCESS").length).toBeGreaterThan(0);
    expect(screen.getByText("QUEUED")).toBeInTheDocument();
    // "PENDING" appears twice — the activity pill AND the approvals pill.
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
  });
});
