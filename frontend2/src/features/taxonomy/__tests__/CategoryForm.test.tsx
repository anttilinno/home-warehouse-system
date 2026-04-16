import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "./fixtures";
import { CategoryForm } from "../forms/CategoryForm";

describe("CategoryForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits with name only when valid", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <>
        <CategoryForm formId="t" onSubmit={onSubmit} parentOptions={[]} />
        <button type="submit" form="t">go</button>
      </>,
    );
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Tools" } });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.name).toBe("Tools");
    expect(arg.parent_category_id).toBeUndefined();
    expect(arg.description).toBeUndefined();
  });

  it("shows 'Name is required.' inline when name empty", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <CategoryForm formId="t2" onSubmit={onSubmit} parentOptions={[]} />
        <button type="submit" form="t2">go</button>
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => {
      expect(screen.getByText("Name is required.")).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onDirtyChange(true) after typing into name", async () => {
    const onDirtyChange = vi.fn();
    renderWithProviders(
      <CategoryForm
        formId="t3"
        onSubmit={vi.fn()}
        parentOptions={[]}
        onDirtyChange={onDirtyChange}
      />,
    );
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "X" } });
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenCalledWith(true);
    });
  });
});
