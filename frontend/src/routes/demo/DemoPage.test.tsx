import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { DemoPage } from "./DemoPage";

// Smoke render: the /demo surface mounts inside the same provider stack the
// AppShell supplies (ShortcutsProvider for the bulk-action registration,
// ModalStackProvider for the overlay atoms). We assert every family section
// heading renders and at least one atom from each family is in the DOM — proof
// that the composition wires up without crashing (Success Criterion 1).
function renderDemo() {
  return render(
    <I18nProvider i18n={i18n}>
      <ShortcutsProvider>
        <ModalStackProvider>
          <DemoPage />
        </ModalStackProvider>
      </ShortcutsProvider>
    </I18nProvider>,
  );
}

describe("DemoPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders all five family section headings", () => {
    renderDemo();
    for (const name of [
      /form atoms/i,
      /overlay atoms/i,
      /feedback atoms/i,
      /data atoms/i,
      /filter atoms/i,
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("mounts at least one atom from the FORM family", () => {
    renderDemo();
    // RetroSelect renders a labelled native <select>.
    expect(
      screen.getByRole("combobox", { name: /category/i }),
    ).toBeInTheDocument();
  });

  it("mounts at least one atom from the OVERLAY family", () => {
    renderDemo();
    expect(
      screen.getByRole("button", { name: /confirm dialog/i }),
    ).toBeInTheDocument();
  });

  it("mounts at least one atom from the FEEDBACK family", () => {
    renderDemo();
    // StatusPill (RetroBadge) renders the DANGER label.
    expect(screen.getByText("DANGER")).toBeInTheDocument();
    // RetroEmptyState heading.
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it("mounts at least one atom from the DATA family", () => {
    renderDemo();
    // RetroTable rows render the demo items.
    expect(screen.getByText("Cordless drill")).toBeInTheDocument();
    // RetroPagination nav landmark.
    expect(
      screen.getByRole("navigation", { name: /pagination/i }),
    ).toBeInTheDocument();
  });

  it("mounts at least one atom from the FILTER family", () => {
    renderDemo();
    // FilterBar search input.
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    // SavedFilters preset chip.
    expect(
      screen.getByRole("button", { name: /low stock/i }),
    ).toBeInTheDocument();
  });
});
