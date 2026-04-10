import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { RetroPanel } from "../RetroPanel";

describe("RetroPanel", () => {
  it("renders children", () => {
    render(<RetroPanel>Panel content</RetroPanel>);
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("renders hazard stripe when showHazardStripe is true", () => {
    const { container } = render(
      <RetroPanel showHazardStripe>Content</RetroPanel>
    );
    const stripe = container.querySelector(".bg-hazard-stripe");
    expect(stripe).toBeInTheDocument();
  });

  it("does not render hazard stripe by default", () => {
    const { container } = render(<RetroPanel>Content</RetroPanel>);
    const stripe = container.querySelector(".bg-hazard-stripe");
    expect(stripe).not.toBeInTheDocument();
  });

  it("renders close button with aria-label when showClose is true", () => {
    render(
      <RetroPanel showClose onClose={() => {}}>
        Content
      </RetroPanel>
    );
    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn.className).toContain("bg-retro-red");
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <RetroPanel showClose onClose={onClose}>
        Content
      </RetroPanel>
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders title as h2", () => {
    render(<RetroPanel title="My Panel">Content</RetroPanel>);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("My Panel");
    expect(heading.className).toContain("uppercase");
  });

  it("forwards ref to the panel div", () => {
    const ref = createRef<HTMLDivElement>();
    render(<RetroPanel ref={ref}>Content</RetroPanel>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("merges custom className", () => {
    const { container } = render(
      <RetroPanel className="my-panel">Content</RetroPanel>
    );
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.className).toContain("my-panel");
    expect(panel.className).toContain("bg-retro-cream");
  });

  it("applies base panel styling", () => {
    const { container } = render(<RetroPanel>Content</RetroPanel>);
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.className).toContain("border-retro-thick");
    expect(panel.className).toContain("border-retro-ink");
    expect(panel.className).toContain("shadow-retro-raised");
    expect(panel.className).toContain("p-lg");
  });
});
