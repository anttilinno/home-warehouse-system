import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RetroTable } from "../RetroTable";

const columns = [
  { key: "name", header: "Name" },
  { key: "status", header: "Status" },
];

const data = [
  { name: "Item A", status: "Active" },
  { name: "Item B", status: "Inactive" },
];

describe("RetroTable", () => {
  it("renders header cells", () => {
    render(<RetroTable columns={columns} data={data} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders data cells", () => {
    render(<RetroTable columns={columns} data={data} />);
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("wraps table in overflow-x-auto container", () => {
    render(<RetroTable columns={columns} data={data} />);
    const table = document.querySelector("table")!;
    expect(table.parentElement!.className).toContain("overflow-x-auto");
  });

  it("header has bg-retro-charcoal class", () => {
    render(<RetroTable columns={columns} data={data} />);
    const th = screen.getByText("Name").closest("th")!;
    expect(th.className).toContain("bg-retro-charcoal");
  });

  it("data cells have font-mono class", () => {
    render(<RetroTable columns={columns} data={data} />);
    const td = screen.getByText("Item A").closest("td")!;
    expect(td.className).toContain("font-mono");
  });

  it("merges className on wrapper", () => {
    render(<RetroTable columns={columns} data={data} className="extra" />);
    const table = document.querySelector("table")!;
    expect(table.parentElement!.className).toContain("extra");
  });
});
