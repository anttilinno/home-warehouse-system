import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { PageHeader } from "./PageHeader";
import type { Crumb } from "./breadcrumbs";

const CRUMBS: Crumb[] = [
  { label: "Overview", to: "/" },
  { label: "Dashboard" },
];

function renderPageHeader(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider i18n={i18n}>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

describe("PageHeader", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the breadcrumb crumbs joined by an ink separator", () => {
    renderPageHeader(<PageHeader crumbs={CRUMBS} />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(
      screen.getByText("Dashboard", { selector: "nav *" }),
    ).toBeInTheDocument();
    expect(screen.getByText("›")).toBeInTheDocument();
  });

  it("names the page with one h1 from the leaf crumb", () => {
    renderPageHeader(<PageHeader crumbs={CRUMBS} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("renders an ancestor crumb with a `to` as a link and the leaf as a span", () => {
    renderPageHeader(<PageHeader crumbs={CRUMBS} />);
    const ancestor = screen.getByText("Overview");
    const leaf = screen.getByText("Dashboard", { selector: "nav *" });
    expect(ancestor.closest("a")).toHaveAttribute("href", "/");
    expect(leaf.tagName).toBe("SPAN");
    expect(leaf).toHaveAttribute("aria-current", "page");
    expect(leaf.className).toContain("text-fg-ink");
  });

  it("renders the LAST SYNC em-dash placeholder by default this phase", () => {
    renderPageHeader(<PageHeader crumbs={CRUMBS} />);
    expect(screen.getByText("LAST SYNC")).toBeInTheDocument();
    expect(screen.getByTestId("page-header-lastsync")).toHaveTextContent("—");
  });

  it("honors a provided lastSync value", () => {
    renderPageHeader(
      <PageHeader crumbs={[{ label: "Overview" }]} lastSync="10:00:00" />,
    );
    expect(screen.getByTestId("page-header-lastsync")).toHaveTextContent(
      "10:00:00",
    );
  });

  it("leaves SESSION to the Bottombar clock (no duplicate readout)", () => {
    renderPageHeader(<PageHeader crumbs={[{ label: "Overview" }]} />);
    expect(screen.queryByText("SESSION")).toBeNull();
  });

  it("renders the meta line with tabular-nums", () => {
    const { container } = renderPageHeader(
      <PageHeader crumbs={[{ label: "Overview" }]} />,
    );
    expect(container.querySelector(".tabular-nums")).not.toBeNull();
  });
});
