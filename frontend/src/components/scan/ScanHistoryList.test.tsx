import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { ScanHistoryList } from "./ScanHistoryList";
import type { ScanHistoryEntry } from "@/lib/scanner";

function entry(code: string, timestamp: number): ScanHistoryEntry {
  return { code, timestamp, format: "history", entityType: "unknown" };
}

function renderList(
  entries: ScanHistoryEntry[],
  { onSelect = vi.fn(), onClear = vi.fn() } = {},
) {
  render(
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>
        <ScanHistoryList
          entries={entries}
          onSelect={onSelect}
          onClear={onClear}
        />
      </ModalStackProvider>
    </I18nProvider>,
  );
  return { onSelect, onClear };
}

describe("ScanHistoryList", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders rows and re-fires onSelect('history') on a row tap", async () => {
    const { onSelect } = renderList([
      entry("0123456789012", Date.now() - 120_000),
      entry("5901234123457", Date.now() - 3_600_000),
    ]);
    expect(screen.getByText("0123456789012")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /0123456789012/ }),
    );
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(
      "0123456789012",
      "history",
    );
  });

  it("CLEAR HISTORY confirms before clearing", async () => {
    const { onClear } = renderList([entry("0123456789012", Date.now())]);
    await userEvent.click(
      screen.getByRole("button", { name: /CLEAR HISTORY/ }),
    );
    // Not cleared until the confirm dialog's confirm button is pressed.
    expect(onClear).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^CLEAR HISTORY$/ }),
    );
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("empty history shows the empty state and disables CLEAR HISTORY", () => {
    renderList([]);
    expect(screen.getByText("NO SCANS YET")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /CLEAR HISTORY/ }),
    ).toBeDisabled();
  });
});
