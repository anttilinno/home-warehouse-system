import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RetroBadge } from "../RetroBadge";

describe("RetroBadge", () => {
  it("renders children text", () => {
    render(<RetroBadge>Active</RetroBadge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("default variant is neutral with bg-retro-gray", () => {
    render(<RetroBadge>Status</RetroBadge>);
    const el = screen.getByText("Status");
    expect(el.className).toContain("bg-retro-gray");
    expect(el.className).toContain("text-white");
  });

  it("success variant applies bg-retro-green", () => {
    render(<RetroBadge variant="success">OK</RetroBadge>);
    expect(screen.getByText("OK").className).toContain("bg-retro-green");
  });

  it("danger variant applies bg-retro-red", () => {
    render(<RetroBadge variant="danger">Error</RetroBadge>);
    expect(screen.getByText("Error").className).toContain("bg-retro-red");
  });

  it("warning variant applies bg-retro-amber", () => {
    render(<RetroBadge variant="warning">Warn</RetroBadge>);
    const el = screen.getByText("Warn");
    expect(el.className).toContain("bg-retro-amber");
    expect(el.className).toContain("text-retro-ink");
  });

  it("info variant applies bg-retro-blue", () => {
    render(<RetroBadge variant="info">Info</RetroBadge>);
    expect(screen.getByText("Info").className).toContain("bg-retro-blue");
  });

  it("merges className", () => {
    render(<RetroBadge className="extra">Tag</RetroBadge>);
    const el = screen.getByText("Tag");
    expect(el.className).toContain("extra");
    expect(el.className).toContain("border-retro-thick");
  });
});
