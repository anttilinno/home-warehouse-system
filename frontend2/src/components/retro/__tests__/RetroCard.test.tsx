import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { RetroCard } from "../RetroCard";

describe("RetroCard", () => {
  it("renders children", () => {
    render(<RetroCard>Card content</RetroCard>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies border and shadow classes", () => {
    render(<RetroCard>Content</RetroCard>);
    const el = screen.getByText("Content").closest("div")!;
    expect(el.className).toContain("border-retro-thick");
    expect(el.className).toContain("border-retro-ink");
    expect(el.className).toContain("shadow-retro-raised");
    expect(el.className).toContain("bg-retro-cream");
    expect(el.className).toContain("p-md");
  });

  it("forwards ref to the div", () => {
    const ref = createRef<HTMLDivElement>();
    render(<RetroCard ref={ref}>Ref test</RetroCard>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.textContent).toBe("Ref test");
  });

  it("merges className", () => {
    render(<RetroCard className="my-custom">Custom</RetroCard>);
    const el = screen.getByText("Custom").closest("div")!;
    expect(el.className).toContain("my-custom");
    expect(el.className).toContain("border-retro-thick");
  });
});
