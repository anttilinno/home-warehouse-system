import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import type { Movement } from "@/lib/types";
import { MovementsPanel } from "./MovementsPanel";

function wrap(ui: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

function makeMovement(over: Partial<Movement> = {}): Movement {
  return {
    id: "mv-1",
    workspace_id: "ws-A",
    inventory_id: "inv-1",
    from_location_id: "loc-1",
    to_location_id: "loc-2",
    quantity: 2,
    created_at: "2026-06-13T14:30:00Z",
    ...over,
  };
}

describe("MovementsPanel", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the NO MOVEMENTS empty state for an empty list", () => {
    wrap(<MovementsPanel movements={[]} />);
    expect(screen.getByText(/no movements/i)).toBeInTheDocument();
    expect(
      screen.getByText(/this item hasn't been moved yet/i),
    ).toBeInTheDocument();
  });

  it("renders movement rows with timestamp, path, qty and mover", () => {
    const { container } = wrap(
      <MovementsPanel
        movements={[makeMovement({ moved_by: "u-1" })]}
        resolveLocation={(id) => (id === "loc-1" ? "Garage" : "Attic")}
        resolveMember={() => "Antti"}
      />,
    );
    const row = container.querySelector("li")!;
    const text = row.textContent ?? "";
    expect(text).toContain("2026-06-13 14:30");
    expect(text).toContain("Garage");
    expect(text).toContain("Attic");
    expect(text).toContain("×2");
    expect(text).toContain("Antti");
  });

  it("renders an initial placement (null from) as `— → {to}`", () => {
    const { container } = wrap(
      <MovementsPanel
        movements={[makeMovement({ from_location_id: undefined })]}
        resolveLocation={(id) => (id === "loc-2" ? "Attic" : undefined)}
      />,
    );
    // The `—` dash precedes the arrow into the resolved destination.
    const text = container.querySelector("li")!.textContent ?? "";
    expect(text).toMatch(/—\s*→\s*Attic/);
  });

  it("falls back to Unknown when the mover can't be resolved", () => {
    wrap(<MovementsPanel movements={[makeMovement({ moved_by: "u-1" })]} />);
    expect(screen.getByText(/unknown/i)).toBeInTheDocument();
  });
});
