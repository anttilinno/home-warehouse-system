import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "./fixtures";
import { ContainerForm } from "../forms/ContainerForm";

const LOC_UUID = "00000000-0000-0000-0000-000000000001";

describe("ContainerForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks submit when location_id is not selected and shows 'Location is required.'", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <ContainerForm
          formId="cf1"
          onSubmit={onSubmit}
          locationOptions={[{ value: LOC_UUID, label: "Garage" }]}
        />
        <button type="submit" form="cf1">go</button>
      </>,
    );
    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: "Red Bin" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => {
      expect(screen.getByText("Location is required.")).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when name + location_id are provided", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <>
        <ContainerForm
          formId="cf2"
          onSubmit={onSubmit}
          locationOptions={[{ value: LOC_UUID, label: "Garage" }]}
          defaultValues={{ location_id: LOC_UUID }}
        />
        <button type="submit" form="cf2">go</button>
      </>,
    );
    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: "Red Bin" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.name).toBe("Red Bin");
    expect(arg.location_id).toBe(LOC_UUID);
  });

  it("shows 'Name is required.' when name is empty", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <ContainerForm
          formId="cf3"
          onSubmit={onSubmit}
          locationOptions={[{ value: LOC_UUID, label: "Garage" }]}
          defaultValues={{ location_id: LOC_UUID }}
        />
        <button type="submit" form="cf3">go</button>
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
});
