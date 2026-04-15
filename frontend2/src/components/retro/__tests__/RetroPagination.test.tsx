import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RetroPagination } from "../RetroPagination";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("RetroPagination", () => {
  it("returns null when totalCount <= pageSize", () => {
    const { container } = renderWithI18n(
      <RetroPagination page={1} pageSize={25} totalCount={10} onChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders prev/next disabled at boundaries", () => {
    renderWithI18n(
      <RetroPagination page={1} pageSize={25} totalCount={137} onChange={() => {}} />
    );
    const prev = screen.getByRole("button", { name: /prev/i });
    expect(prev).toBeDisabled();
    const next = screen.getByRole("button", { name: /next/i });
    expect(next).not.toBeDisabled();
  });

  it("calls onChange(n) when page button clicked", () => {
    const spy = vi.fn();
    renderWithI18n(
      <RetroPagination page={1} pageSize={25} totalCount={137} onChange={spy} />
    );
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(spy).toHaveBeenCalledWith(3);
  });

  it("renders Page {N} of {M} in mono font", () => {
    const { container } = renderWithI18n(
      <RetroPagination page={2} pageSize={25} totalCount={137} onChange={() => {}} />
    );
    const monos = container.querySelectorAll(".font-mono");
    const counter = Array.from(monos).find((el) =>
      /Page/i.test(el.textContent || "")
    );
    expect(counter).toBeTruthy();
    expect(counter!.textContent).toMatch(/Page\s*2\s*of\s*6/);
    expect(counter!.className).toContain("font-mono");
  });
});
