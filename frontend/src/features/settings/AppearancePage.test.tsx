import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeProvider } from "@/lib/useTheme";
import { AppearancePage } from "./AppearancePage";

// Dark Mode P1 — AppearancePage is now a Light / Dark / System selector wired to
// useTheme (localStorage). Default pref is `system`; picking an option persists
// it and re-applies <html data-theme>.

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <ThemeProvider>
        <AppearancePage />
      </ThemeProvider>
    </I18nProvider>,
  );
}

describe("AppearancePage (Dark Mode theme selector)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders Light, Dark and System radio options", () => {
    renderPage();

    expect(screen.getByRole("radio", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /system/i })).toBeInTheDocument();
  });

  it("defaults to System selected (no stored pref)", () => {
    renderPage();

    expect(screen.getByRole("radio", { name: /system/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("CURRENT")).toBeInTheDocument();
  });

  it("selecting Dark persists the pref and applies data-theme", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("radio", { name: /dark/i }));

    expect(screen.getByRole("radio", { name: /dark/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("selecting Light applies the light theme", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("radio", { name: /light/i }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
