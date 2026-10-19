import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { TabBar } from "./TabBar";

function activeTabAt(path: string) {
  render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <TabBar onOpenMore={() => {}} />
      </MemoryRouter>
    </I18nProvider>,
  );
  const nav = screen.getByRole("navigation", { name: "Primary (mobile)" });
  return [...nav.querySelectorAll("a, button")]
    .filter((el) => el.className.includes("bg-selection-fill"))
    .map((el) => el.textContent);
}

describe("TabBar", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it.each([
    ["/", "Home"],
    ["/items/123", "Items"],
    ["/inventory", "Items"],
    ["/inventory/expiring", "Items"],
    ["/scan", "Scan"],
    ["/loans?tab=history", "Loans"],
    ["/borrowers", "More"],
    ["/settings/profile", "More"],
  ])("lights exactly one tab at %s (%s)", (path, label) => {
    expect(activeTabAt(path)).toEqual([label]);
  });
});
