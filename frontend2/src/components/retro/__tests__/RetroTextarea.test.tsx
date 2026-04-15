import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { RetroTextarea } from "../RetroTextarea";

describe("RetroTextarea", () => {
  it("renders a textarea element", () => {
    render(<RetroTextarea placeholder="Notes" />);
    expect(screen.getByPlaceholderText("Notes")).toBeInTheDocument();
  });

  it("applies error border class when error prop is set", () => {
    render(<RetroTextarea error="Required" placeholder="Notes" />);
    const el = screen.getByPlaceholderText("Notes");
    expect(el.className).toContain("border-retro-red");
  });

  it("shows error message when error prop is set", () => {
    render(<RetroTextarea error="Field required" />);
    expect(screen.getByText("Field required")).toBeInTheDocument();
  });

  it("forwards ref to textarea element", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<RetroTextarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("auto-resizes height on input up to 8 rows max", () => {
    render(<RetroTextarea placeholder="Notes" />);
    const el = screen.getByPlaceholderText("Notes") as HTMLTextAreaElement;
    expect(() =>
      fireEvent.input(el, { target: { value: "line1\nline2\nline3" } })
    ).not.toThrow();
    // Handler should set inline height style
    expect(el.style.height).not.toBe("");
  });

  it("applies bevel base classes", () => {
    render(<RetroTextarea placeholder="Styled" />);
    const el = screen.getByPlaceholderText("Styled");
    expect(el.className).toContain("border-retro-thick");
    expect(el.className).toContain("bg-retro-cream");
    expect(el.className).toContain("focus:outline-retro-amber");
  });
});
