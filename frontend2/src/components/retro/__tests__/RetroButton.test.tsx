import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { RetroButton } from "../RetroButton";

describe("RetroButton", () => {
  it("renders with default neutral variant", () => {
    render(<RetroButton>Click me</RetroButton>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("bg-retro-cream");
    expect(button.className).toContain("shadow-retro-raised");
  });

  it("renders primary variant", () => {
    render(<RetroButton variant="primary">Primary</RetroButton>);
    const button = screen.getByRole("button", { name: "Primary" });
    expect(button.className).toContain("bg-retro-amber");
  });

  it("renders danger variant", () => {
    render(<RetroButton variant="danger">Danger</RetroButton>);
    const button = screen.getByRole("button", { name: "Danger" });
    expect(button.className).toContain("bg-retro-red");
    expect(button.className).toContain("text-white");
  });

  it("applies disabled state classes", () => {
    render(<RetroButton disabled>Disabled</RetroButton>);
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:bg-retro-gray");
    expect(button.className).toContain("disabled:cursor-not-allowed");
  });

  it("forwards ref to button element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<RetroButton ref={ref}>Ref test</RetroButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe("Ref test");
  });

  it("merges custom className", () => {
    render(<RetroButton className="my-custom-class">Custom</RetroButton>);
    const button = screen.getByRole("button", { name: "Custom" });
    expect(button.className).toContain("my-custom-class");
    expect(button.className).toContain("border-retro-thick");
  });

  it("spreads HTML attributes onto button", () => {
    render(<RetroButton type="submit" data-testid="submit-btn">Submit</RetroButton>);
    const button = screen.getByTestId("submit-btn");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("applies base styling classes", () => {
    render(<RetroButton>Styled</RetroButton>);
    const button = screen.getByRole("button", { name: "Styled" });
    expect(button.className).toContain("h-[44px]");
    expect(button.className).toContain("border-retro-thick");
    expect(button.className).toContain("border-retro-ink");
    expect(button.className).toContain("text-[14px]");
    expect(button.className).toContain("font-bold");
    expect(button.className).toContain("uppercase");
  });

  it("applies focus-visible outline", () => {
    render(<RetroButton>Focus</RetroButton>);
    const button = screen.getByRole("button", { name: "Focus" });
    expect(button.className).toContain("focus-visible:outline-retro-amber");
  });
});
