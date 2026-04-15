import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, useImperativeHandle, forwardRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RetroFormField } from "../RetroFormField";
import { RetroTextarea } from "../RetroTextarea";
import { RetroInput } from "../RetroInput";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

interface FocusHandle {
  setFocus: (name: "name") => void;
}

const FocusForm = forwardRef<FocusHandle>((_props, ref) => {
  const schema = z.object({ name: z.string().min(1, { message: "Name is required." }) });
  const { control, setFocus } = useForm<{ name: string }>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });
  useImperativeHandle(ref, () => ({ setFocus: (n) => setFocus(n) }));
  return (
    <form>
      <RetroFormField name="name" control={control} label="NAME" helper="Your full name">
        <RetroInput placeholder="name-input" />
      </RetroFormField>
    </form>
  );
});
FocusForm.displayName = "FocusForm";

function SubmitForm() {
  const schema = z.object({ name: z.string().min(1, { message: "Name is required." }) });
  const { control, handleSubmit } = useForm<{ name: string }>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });
  return (
    <form onSubmit={handleSubmit(() => {})}>
      <RetroFormField name="name" control={control} label="NAME">
        <RetroInput placeholder="name-input" />
      </RetroFormField>
      <button type="submit">Submit</button>
    </form>
  );
}

function HelperForm() {
  const { control } = useForm<{ notes: string }>({ defaultValues: { notes: "" } });
  return (
    <RetroFormField name="notes" control={control} label="NOTES" helper="Optional notes">
      <RetroTextarea />
    </RetroFormField>
  );
}

describe("RetroFormField", () => {
  it("renders label above child primitive", () => {
    renderWithI18n(<HelperForm />);
    expect(screen.getByText("NOTES")).toBeInTheDocument();
  });

  it("surfaces zod validation error below child when validation fails on submit", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SubmitForm />);
    await user.click(screen.getByRole("button", { name: /submit/i }));
    const errors = await screen.findAllByText("Name is required.");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("renders helper text when no error", () => {
    renderWithI18n(<HelperForm />);
    expect(screen.getByText("Optional notes")).toBeInTheDocument();
  });

  it("setFocus(name) from RHF focuses the underlying DOM element", async () => {
    const ref = { current: null as FocusHandle | null };
    renderWithI18n(<FocusForm ref={ref} />);
    const input = screen.getByPlaceholderText("name-input");
    act(() => {
      ref.current?.setFocus("name");
    });
    // RHF's setFocus uses setTimeout — wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.activeElement).toBe(input);
  });
});
