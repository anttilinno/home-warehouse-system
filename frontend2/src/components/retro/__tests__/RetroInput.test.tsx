import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { RetroInput } from "../RetroInput";

describe("RetroInput", () => {
  it("renders an input element", () => {
    render(<RetroInput placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("renders icon prefix with aria-hidden", () => {
    const icon = <span data-testid="icon">@</span>;
    const { container } = render(<RetroInput icon={icon} />);
    const iconWrapper = container.querySelector("[aria-hidden='true']");
    expect(iconWrapper).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("applies pl-[40px] when icon is present", () => {
    const icon = <span>@</span>;
    render(<RetroInput icon={icon} placeholder="With icon" />);
    const input = screen.getByPlaceholderText("With icon");
    expect(input.className).toContain("pl-[40px]");
  });

  it("applies pl-sm when no icon", () => {
    render(<RetroInput placeholder="No icon" />);
    const input = screen.getByPlaceholderText("No icon");
    expect(input.className).toContain("pl-sm");
    expect(input.className).not.toContain("pl-[40px]");
  });

  it("shows error message when error prop is set", () => {
    render(<RetroInput error="Required field" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });

  it("applies border-retro-red on error", () => {
    render(<RetroInput error="Error" placeholder="Error input" />);
    const input = screen.getByPlaceholderText("Error input");
    expect(input.className).toContain("border-retro-red");
  });

  it("applies error message styling", () => {
    render(<RetroInput error="Error msg" />);
    const errorEl = screen.getByText("Error msg");
    expect(errorEl.className).toContain("text-retro-red");
    expect(errorEl.className).toContain("text-[12px]");
  });

  it("applies disabled state", () => {
    render(<RetroInput disabled placeholder="Disabled" />);
    const input = screen.getByPlaceholderText("Disabled");
    expect(input).toBeDisabled();
    expect(input.className).toContain("disabled:bg-retro-gray");
  });

  it("forwards ref to input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<RetroInput ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("spreads HTML attributes onto input", () => {
    render(
      <RetroInput
        placeholder="Email"
        type="email"
        required
        data-testid="email-input"
      />
    );
    const input = screen.getByTestId("email-input");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("placeholder", "Email");
    expect(input).toBeRequired();
  });

  it("applies base styling classes", () => {
    render(<RetroInput placeholder="Styled" />);
    const input = screen.getByPlaceholderText("Styled");
    expect(input.className).toContain("h-[40px]");
    expect(input.className).toContain("font-mono");
    expect(input.className).toContain("border-retro-thick");
  });
});
