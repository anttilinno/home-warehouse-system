import { render } from "@testing-library/react";
import { HazardStripe } from "../HazardStripe";

describe("HazardStripe", () => {
  it("renders with bg-hazard-stripe class", () => {
    const { container } = render(<HazardStripe />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("bg-hazard-stripe");
  });

  it("has default height of 8px", () => {
    const { container } = render(<HazardStripe />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe("8px");
  });

  it("accepts custom height prop via style", () => {
    const { container } = render(<HazardStripe height={16} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe("16px");
  });

  it("renders full width", () => {
    const { container } = render(<HazardStripe />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("w-full");
  });

  it("accepts className prop", () => {
    const { container } = render(<HazardStripe className="mb-md" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("mb-md");
    expect(el.className).toContain("bg-hazard-stripe");
  });
});
