import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "./fixtures";
import { LocationForm } from "../forms/LocationForm";

describe("LocationForm", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-fills short_code 300ms after typing name", async () => {
    renderWithProviders(
      <LocationForm formId="lf1" onSubmit={vi.fn()} parentOptions={[]} />,
    );
    const nameInput = screen.getByLabelText(/^name/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Garage Shelf 1" } });
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    const shortCode = screen.getByLabelText(/short code/i) as HTMLInputElement;
    await waitFor(() => {
      expect(shortCode.value).toMatch(/^GAR-\d{3}$/);
    });
  });

  it("does not clobber a manually-edited short_code on name re-render", async () => {
    renderWithProviders(
      <LocationForm formId="lf2" onSubmit={vi.fn()} parentOptions={[]} />,
    );
    const nameInput = screen.getByLabelText(/^name/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Attic" } });
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    const shortCode = screen.getByLabelText(/short code/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(shortCode, { target: { value: "OVERRIDE" } });
    });
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Attic2" } });
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(shortCode.value).toBe("OVERRIDE");
  });

  it("submits with short_code omitted when autoLinked is true", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <>
        <LocationForm formId="lf3" onSubmit={onSubmit} parentOptions={[]} />
        <button type="submit" form="lf3">go</button>
      </>,
    );
    const nameInput = screen.getByLabelText(/^name/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Garage" } });
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.name).toBe("Garage");
    expect(arg.short_code).toBeUndefined();
  });

  it("shows 'Name is required.' when name is empty on submit", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <LocationForm formId="lf4" onSubmit={onSubmit} parentOptions={[]} />
        <button type="submit" form="lf4">go</button>
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => {
      const errs = screen.queryAllByText("Name is required.");
      expect(errs.length).toBeGreaterThanOrEqual(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
