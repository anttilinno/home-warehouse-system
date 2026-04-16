import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks } from "./fixtures";
import { BorrowerForm } from "../forms/BorrowerForm";

describe("BorrowerForm", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("submits with name only when valid — empty optionals coerced to undefined", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <>
        <BorrowerForm formId="bf1" onSubmit={onSubmit} />
        <button type="submit" form="bf1">go</button>
      </>,
    );
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Alice" } });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.name).toBe("Alice");
    expect(arg.email).toBeUndefined();
    expect(arg.phone).toBeUndefined();
    expect(arg.notes).toBeUndefined();
  });

  it("shows 'Name is required.' inline when name empty", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <BorrowerForm formId="bf2" onSubmit={onSubmit} />
        <button type="submit" form="bf2">go</button>
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

  it("calls onDirtyChange(true) after typing into name", async () => {
    const onDirtyChange = vi.fn();
    renderWithProviders(
      <BorrowerForm
        formId="bf3"
        onSubmit={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "A" } });
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenCalledWith(true);
    });
  });

  it("rejects invalid email format with visible error on submit", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <BorrowerForm formId="bf4" onSubmit={onSubmit} />
        <button type="submit" form="bf4">go</button>
      </>,
    );
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(nameInput, { target: { value: "Alice" } });
    fireEvent.change(emailInput, { target: { value: "not-an-email" } });
    // Use fireEvent.submit on the form directly — clicking the external submit
    // button triggers jsdom HTML5 email constraint validation which blocks the
    // submit event before RHF can run, so zod never fires.
    const form = document.getElementById("bf4") as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });
    await waitFor(() => {
      const errs = screen.queryAllByText("Enter a valid email address.");
      expect(errs.length).toBeGreaterThanOrEqual(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefills defaultValues into the form inputs", () => {
    renderWithProviders(
      <BorrowerForm
        formId="bf5"
        onSubmit={vi.fn()}
        defaultValues={{
          name: "Bob",
          email: "bob@example.com",
          phone: "+372 555 1234",
          notes: "Trusted neighbour",
        }}
      />,
    );
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe(
      "Bob",
    );
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe(
      "bob@example.com",
    );
    expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe(
      "+372 555 1234",
    );
    expect(
      (screen.getByLabelText(/notes/i) as HTMLTextAreaElement).value,
    ).toBe("Trusted neighbour");
  });
});
