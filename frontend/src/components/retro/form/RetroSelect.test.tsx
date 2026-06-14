import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { useRef } from "react";
import { RetroSelect } from "./RetroSelect";

function wrap(ui: React.ReactNode) {
  return <I18nProvider i18n={i18n}>{ui}</I18nProvider>;
}

describe("RetroSelect", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders a NATIVE <select> with the sunken field chrome", () => {
    render(
      wrap(
        <RetroSelect label="Bucket" aria-label="bucket">
          <option value="a">A</option>
          <option value="b">B</option>
        </RetroSelect>,
      ),
    );
    const select = screen.getByLabelText("bucket");
    expect(select.tagName).toBe("SELECT");
    expect(select.className).toContain("bevel-sunken");
  });

  it("forwards ref + name/onChange (RHF-compatible)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Host() {
      const ref = useRef<HTMLSelectElement>(null);
      return (
        <RetroSelect
          label="Bucket"
          aria-label="bucket"
          name="bucket"
          ref={ref}
          onChange={onChange}
        >
          <option value="a">A</option>
          <option value="b">B</option>
        </RetroSelect>
      );
    }
    render(wrap(<Host />));
    const select = screen.getByLabelText("bucket") as HTMLSelectElement;
    expect(select.name).toBe("bucket");
    await user.selectOptions(select, "b");
    expect(onChange).toHaveBeenCalled();
    expect(select.value).toBe("b");
  });

  it("flips to the danger treatment + aria-invalid on error", () => {
    render(
      wrap(
        <RetroSelect label="Bucket" aria-label="bucket" error="Required">
          <option value="a">A</option>
        </RetroSelect>,
      ),
    );
    const select = screen.getByLabelText("bucket");
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(select.className).toContain("border-danger");
  });
});
