import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { RetroPagination } from "./RetroPagination";

function renderPager(
  props: Partial<React.ComponentProps<typeof RetroPagination>> = {},
) {
  const onPageChange = props.onPageChange ?? vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <RetroPagination
        page={props.page ?? 1}
        pageCount={props.pageCount ?? 5}
        perPage={props.perPage ?? 20}
        onPageChange={onPageChange}
      />
    </I18nProvider>,
  );
  return { onPageChange };
}

describe("RetroPagination", () => {
  it("renders a Pagination nav with prev/next; prev disabled on page 1", () => {
    renderPager({ page: 1, pageCount: 5 });
    const nav = screen.getByRole("navigation", { name: /pagination/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
  });

  it("disables next on the last page", () => {
    renderPager({ page: 5, pageCount: 5 });
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /prev/i })).not.toBeDisabled();
  });

  it("marks the current page button with aria-current and the accent fill", () => {
    renderPager({ page: 3, pageCount: 5 });
    const current = screen.getByRole("button", { name: "3" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.className).toContain("bg-titlebar-blue");
  });

  it("calls onPageChange with the right page for a page button", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderPager({ page: 1, pageCount: 5 });
    await user.click(screen.getByRole("button", { name: "4" }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("calls onPageChange for prev and next relative to the current page", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderPager({ page: 3, pageCount: 5 });
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    await user.click(screen.getByRole("button", { name: /prev/i }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });

  it("renders the meta sentence 'page {n} of {m} · {k} / page' as tabular-nums mono", () => {
    renderPager({ page: 2, pageCount: 7, perPage: 25 });
    const meta = screen.getByText(/page 2 of 7 · 25 \/ page/i);
    expect(meta).toBeInTheDocument();
    expect(meta.className).toContain("tabular-nums");
  });
});
