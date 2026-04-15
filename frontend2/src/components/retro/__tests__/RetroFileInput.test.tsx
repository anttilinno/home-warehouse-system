import { render, screen, fireEvent } from "@testing-library/react";
import { createRef, type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RetroFileInput } from "../RetroFileInput";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

function getHiddenInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  if (!input) throw new Error("hidden file input not found");
  return input;
}

describe("RetroFileInput", () => {
  it("renders a CHOOSE FILES button", () => {
    renderWithI18n(<RetroFileInput onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /choose files/i })
    ).toBeInTheDocument();
  });

  it("calls onChange with File[] when files are selected", () => {
    const handle = vi.fn();
    const { container } = renderWithI18n(<RetroFileInput onChange={handle} />);
    const input = getHiddenInput(container);
    const file = new File(["a"], "a.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(handle).toHaveBeenCalledTimes(1);
    const arg = handle.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg[0]).toBeInstanceOf(File);
  });

  it("renders a chip per selected file with remove button aria-label", () => {
    const file = new File(["a"], "photo.jpg", { type: "image/jpeg" });
    renderWithI18n(<RetroFileInput value={[file]} onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /remove photo\.jpg/i })
    ).toBeInTheDocument();
  });

  it("resets underlying input value after each selection", () => {
    const { container } = renderWithI18n(
      <RetroFileInput onChange={() => {}} />
    );
    const input = getHiddenInput(container);
    const file = new File(["a"], "a.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(input.value).toBe("");
  });

  it("forwards ref to the hidden input element", () => {
    const ref = createRef<HTMLInputElement>();
    renderWithI18n(<RetroFileInput ref={ref} onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.type).toBe("file");
  });

  it("chip remove button has 44px hit area", () => {
    const file = new File(["a"], "photo.jpg", { type: "image/jpeg" });
    renderWithI18n(<RetroFileInput value={[file]} onChange={() => {}} />);
    const removeBtn = screen.getByRole("button", {
      name: /remove photo\.jpg/i,
    });
    expect(removeBtn.className).toContain("min-h-[44px]");
    expect(removeBtn.className).toContain("min-w-[44px]");
  });
});
