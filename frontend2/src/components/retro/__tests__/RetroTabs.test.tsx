import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RetroTabs } from "../RetroTabs";

const tabs = [
  { key: "tab1", label: "First" },
  { key: "tab2", label: "Second" },
  { key: "tab3", label: "Third" },
];

describe("RetroTabs", () => {
  it("renders all tab labels", () => {
    render(<RetroTabs tabs={tabs} activeTab="tab1" onTabChange={() => {}} />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
  });

  it("active tab has bg-retro-cream and border-b-0", () => {
    render(<RetroTabs tabs={tabs} activeTab="tab1" onTabChange={() => {}} />);
    const activeBtn = screen.getByText("First");
    expect(activeBtn.className).toContain("bg-retro-cream");
    expect(activeBtn.className).toContain("border-b-0");
  });

  it("inactive tab has bg-retro-gray", () => {
    render(<RetroTabs tabs={tabs} activeTab="tab1" onTabChange={() => {}} />);
    const inactiveBtn = screen.getByText("Second");
    expect(inactiveBtn.className).toContain("bg-retro-gray");
    expect(inactiveBtn.className).not.toContain("border-b-0");
  });

  it("clicking tab calls onTabChange with key", () => {
    const onChange = vi.fn();
    render(<RetroTabs tabs={tabs} activeTab="tab1" onTabChange={onChange} />);
    fireEvent.click(screen.getByText("Second"));
    expect(onChange).toHaveBeenCalledWith("tab2");
  });
});
