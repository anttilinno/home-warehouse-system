import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BevelButton,
  RetroBadge,
  RetroInput,
  RetroTable,
  StatCard,
  Window,
} from "@/components/retro";

describe("Window", () => {
  it("renders a titlebar with the title and the body content", () => {
    render(
      <Window title="Navigator" titlebarVariant="mint">
        <p>body content</p>
      </Window>,
    );
    expect(
      screen.getByRole("heading", { name: "Navigator" }),
    ).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("renders chromeless (no titlebar) when title is omitted", () => {
    render(
      <Window>
        <p>bare panel</p>
      </Window>,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("bare panel")).toBeInTheDocument();
  });

  it("renders the actions slot inside the titlebar", () => {
    render(
      <Window title="Activity" actions={<span>limit=10</span>}>
        x
      </Window>,
    );
    expect(screen.getByText("limit=10")).toBeInTheDocument();
  });
});

describe("BevelButton", () => {
  it("defaults to type=button and fires onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BevelButton onClick={onClick}>Scan</BevelButton>);
    const btn = screen.getByRole("button", { name: "Scan" });
    expect(btn).toHaveAttribute("type", "button");
    await user.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <BevelButton disabled onClick={onClick}>
        Save
      </BevelButton>,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("honors an explicit submit type", () => {
    render(<BevelButton type="submit">Log in</BevelButton>);
    expect(screen.getByRole("button", { name: "Log in" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});

describe("RetroInput", () => {
  it("associates the label with the input", () => {
    render(<RetroInput label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("wires error message via aria-describedby and aria-invalid", () => {
    render(<RetroInput label="Password" error="Required" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Required");
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("has no aria-invalid without an error", () => {
    render(<RetroInput label="Email" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });

  it("accepts typed input", async () => {
    const user = userEvent.setup();
    render(<RetroInput label="Email" mono />);
    const input = screen.getByLabelText("Email");
    await user.type(input, "seeder@test.local");
    expect(input).toHaveValue("seeder@test.local");
  });
});

describe("RetroBadge", () => {
  it("renders its content", () => {
    render(<RetroBadge variant="danger">overdue</RetroBadge>);
    expect(screen.getByText("overdue")).toBeInTheDocument();
  });
});

describe("StatCard", () => {
  it("renders label, value, and sub line", () => {
    render(
      <StatCard
        label="Overdue"
        value={3}
        sub="action needed"
        titlebarVariant="pink"
        valueTone="danger"
      />,
    );
    expect(screen.getByRole("heading", { name: "Overdue" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("action needed")).toBeInTheDocument();
  });
});

describe("RetroTable", () => {
  it("renders a composable table and supports aria-selected rows", () => {
    render(
      <RetroTable>
        <thead>
          <tr>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          <tr aria-selected="true">
            <td>Drill</td>
          </tr>
          <tr>
            <td>Ladder</td>
          </tr>
        </tbody>
      </RetroTable>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Drill").closest("tr")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
