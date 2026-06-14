import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { RetroFileInput } from "./RetroFileInput";

function wrap(ui: React.ReactNode) {
  return <I18nProvider i18n={i18n}>{ui}</I18nProvider>;
}

function file(name: string, size = 10, type = "text/plain") {
  const f = new File([new Uint8Array(size)], name, { type });
  return f;
}

describe("RetroFileInput", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("clicking BROWSE… opens the hidden native file input; selecting emits File[]", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(wrap(<RetroFileInput label="Attachments" onChange={onChange} />));
    const native = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(native).toBeInTheDocument();
    expect(native.className).toContain("sr-only");
    // The BROWSE… button is present and clickable.
    const browse = screen.getByRole("button", { name: /browse/i });
    await user.click(browse);
    // Simulate the OS file picker resolving by uploading to the native input.
    await user.upload(native, file("a.txt"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg[0]).toBeInstanceOf(File);
  });

  it("emits File[] on drop", () => {
    const onChange = vi.fn();
    render(wrap(<RetroFileInput label="Attachments" onChange={onChange} />));
    const zone = screen.getByTestId("file-drop-zone");
    fireEvent.drop(zone, {
      dataTransfer: { files: [file("b.txt")] },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0]).toBeInstanceOf(File);
  });

  it("removing a file via ✕ updates the emitted File[]", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(wrap(<RetroFileInput label="Attachments" onChange={onChange} />));
    const native = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(native, [file("a.txt"), file("b.txt")]);
    expect(screen.getByText("a.txt")).toBeInTheDocument();
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await user.click(removeButtons[0]);
    // last onChange call has only b.txt
    const calls = onChange.mock.calls;
    const lastArg = calls[calls.length - 1][0];
    expect(lastArg.map((f: File) => f.name)).toEqual(["b.txt"]);
  });

  it("toggles the dragover highlight on dragover/dragleave", () => {
    render(wrap(<RetroFileInput label="Attachments" onChange={vi.fn()} />));
    const zone = screen.getByTestId("file-drop-zone");
    expect(zone.className).not.toContain("border-titlebar-blue");
    fireEvent.dragOver(zone, { dataTransfer: { files: [] } });
    expect(zone.className).toContain("border-titlebar-blue");
    fireEvent.dragLeave(zone);
    expect(zone.className).not.toContain("border-titlebar-blue");
  });
});
