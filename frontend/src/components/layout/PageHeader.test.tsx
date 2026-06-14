import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { PageHeader } from "./PageHeader";

function renderPageHeader(ui: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("PageHeader", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the breadcrumb segments joined by an ink separator", () => {
    renderPageHeader(<PageHeader segments={["OVERVIEW", "DASHBOARD"]} />);
    expect(screen.getByText("OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("DASHBOARD")).toBeInTheDocument();
    // The two segments are joined by a "›" separator.
    expect(screen.getByText("›")).toBeInTheDocument();
  });

  it("styles the leaf segment as ink and ancestors as muted", () => {
    renderPageHeader(<PageHeader segments={["OVERVIEW", "DASHBOARD"]} />);
    const ancestor = screen.getByText("OVERVIEW");
    const leaf = screen.getByText("DASHBOARD");
    expect(ancestor.className).toContain("text-fg-muted");
    expect(leaf.className).toContain("text-fg-ink");
  });

  it("renders the LAST SYNC em-dash placeholder by default this phase", () => {
    renderPageHeader(<PageHeader segments={["OVERVIEW", "DASHBOARD"]} />);
    expect(screen.getByText("LAST SYNC")).toBeInTheDocument();
    expect(screen.getByTestId("page-header-lastsync")).toHaveTextContent("—");
  });

  it("honors a provided lastSync value", () => {
    renderPageHeader(
      <PageHeader segments={["OVERVIEW"]} lastSync="10:00:00" />,
    );
    expect(screen.getByTestId("page-header-lastsync")).toHaveTextContent(
      "10:00:00",
    );
  });

  it("renders a SESSION readout (reusing the Clock leaf)", () => {
    renderPageHeader(<PageHeader segments={["OVERVIEW"]} />);
    expect(screen.getByText("SESSION")).toBeInTheDocument();
    expect(screen.getByTestId("clock-session")).toBeInTheDocument();
  });

  it("renders the meta line with tabular-nums", () => {
    const { container } = renderPageHeader(
      <PageHeader segments={["OVERVIEW"]} />,
    );
    expect(container.querySelector(".tabular-nums")).not.toBeNull();
  });
});
