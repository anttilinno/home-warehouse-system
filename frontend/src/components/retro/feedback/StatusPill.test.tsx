import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it.each([
    ["ok", "bg-ok-bg"],
    ["warn", "bg-warn-bg"],
    ["info", "bg-info-bg"],
    ["danger", "bg-danger-bg"],
  ] as const)("variant=%s renders %s fill with ink text", (variant, fill) => {
    render(<StatusPill variant={variant}>{variant.toUpperCase()}</StatusPill>);
    const pill = screen.getByText(variant.toUpperCase());
    expect(pill).toHaveClass(fill);
    // RetroBadge always carries ink text on the pastel fill.
    expect(pill).toHaveClass("text-fg-ink");
  });

  it("renders the consumer-supplied label text", () => {
    render(<StatusPill variant="warn">OVERDUE</StatusPill>);
    expect(screen.getByText("OVERDUE")).toBeInTheDocument();
  });

  it("is built on RetroBadge chrome (radius-2 chip, ink border)", () => {
    render(<StatusPill variant="ok">OK</StatusPill>);
    const pill = screen.getByText("OK");
    expect(pill).toHaveClass("rounded-chip", "border", "border-border-ink");
  });

  it("never uses a *-deep text class inside the filled pill", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/retro/feedback/StatusPill.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/text-[a-z-]+-deep/);
  });
});
