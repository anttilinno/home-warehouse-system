import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { useRef } from "react";
import { RetroTextarea } from "./RetroTextarea";

function wrap(ui: React.ReactNode) {
  return <I18nProvider i18n={i18n}>{ui}</I18nProvider>;
}

describe("RetroTextarea", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders a <textarea> with min-h + resize-y chrome", () => {
    render(wrap(<RetroTextarea label="Notes" aria-label="notes" />));
    const ta = screen.getByLabelText("notes");
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta.className).toContain("resize-y");
    expect(ta.className).toContain("min-h-[88px]");
  });

  it("toggles the mono font when mono is set", () => {
    render(wrap(<RetroTextarea label="Notes" aria-label="notes" mono />));
    expect(screen.getByLabelText("notes").className).toContain("font-mono");
  });

  it("forwards ref + RHF props and flips danger on error", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Host() {
      const ref = useRef<HTMLTextAreaElement>(null);
      return (
        <RetroTextarea
          label="Notes"
          aria-label="notes"
          name="notes"
          ref={ref}
          onChange={onChange}
          error="Too long"
        />
      );
    }
    render(wrap(<Host />));
    const ta = screen.getByLabelText("notes") as HTMLTextAreaElement;
    expect(ta.name).toBe("notes");
    expect(ta.getAttribute("aria-invalid")).toBe("true");
    expect(ta.className).toContain("border-danger");
    await user.type(ta, "hi");
    expect(onChange).toHaveBeenCalled();
  });
});
