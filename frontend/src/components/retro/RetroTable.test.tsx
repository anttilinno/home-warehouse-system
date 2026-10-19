import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RetroTable } from "./RetroTable";

function rows() {
  return screen.getAllByRole("row").filter((r) => r.closest("tbody"));
}
function active() {
  return rows().findIndex((r) => r.dataset.activeRow === "true");
}

describe("RetroTable keyboard row cursor", () => {
  it("j/k and arrows move the active row, Enter clicks it", async () => {
    const user = userEvent.setup();
    const onRow = vi.fn();
    render(
      <RetroTable>
        <thead>
          <tr>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {["a", "b", "c"].map((n) => (
            <tr key={n} onClick={() => onRow(n)}>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </RetroTable>,
    );
    const group = screen.getByRole("group", { name: "Table" });
    group.focus();
    expect(active()).toBe(-1);
    await user.keyboard("j");
    expect(active()).toBe(0);
    await user.keyboard("{ArrowDown}j");
    expect(active()).toBe(2);
    await user.keyboard("j"); // clamps at the last row
    expect(active()).toBe(2);
    await user.keyboard("k{ArrowUp}");
    expect(active()).toBe(0);
    await user.keyboard("{Enter}");
    expect(onRow).toHaveBeenCalledWith("a");
  });

  it("ignores keys typed into an editable cell", async () => {
    const user = userEvent.setup();
    render(
      <RetroTable>
        <tbody>
          <tr>
            <td>
              <input aria-label="q" />
            </td>
          </tr>
        </tbody>
      </RetroTable>,
    );
    await user.click(screen.getByLabelText("q"));
    await user.keyboard("j");
    expect(active()).toBe(-1);
  });
});
