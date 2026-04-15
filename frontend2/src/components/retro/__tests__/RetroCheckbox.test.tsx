import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { RetroCheckbox } from "../RetroCheckbox";

describe("RetroCheckbox", () => {
  it("renders a checkbox input with label", () => {
    render(<RetroCheckbox label="Include archived items" />);
    expect(screen.getByText("Include archived items")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("toggles checked state on click via the label hit area", async () => {
    const user = userEvent.setup();
    render(<RetroCheckbox label="Include archived items" />);
    const cb = screen.getByRole("checkbox") as HTMLInputElement;
    expect(cb.checked).toBe(false);
    await user.click(screen.getByText("Include archived items"));
    expect(cb.checked).toBe(true);
  });

  it("forwards ref to input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<RetroCheckbox ref={ref} label="Test" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("applies error border to visual box when error prop is set", () => {
    const { container } = render(
      <RetroCheckbox label="Label" error="Must check" />
    );
    const box = container.querySelector(".border-retro-red");
    expect(box).toBeInTheDocument();
  });

  it("applies 44px hit area to label", () => {
    const { container } = render(<RetroCheckbox label="Label" />);
    const label = container.querySelector("label");
    expect(label?.className).toContain("min-h-[44px]");
    expect(label?.className).toContain("min-w-[44px]");
  });
});
