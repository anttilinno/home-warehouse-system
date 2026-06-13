import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { RegionalFormatsPage } from "./RegionalFormatsPage";

// Phase 12 Plan 04 — SETT-06. Regional formats: four selects + a LOCAL live
// preview (no read-hooks — Phase 15 owns consumption). Partial PATCH (dirty
// fields only) + zod separator-conflict guard mirroring backend entity.go:252.

const ME_PATH = "/api/users/me";
const PREFS_PATH = "/api/users/me/preferences";

const ME = {
  id: "user-1",
  email: "seeder@test.local",
  full_name: "Seed Er",
  avatar_url: null,
  has_password: true,
  date_format: "YYYY-MM-DD",
  time_format: "HH:mm",
  thousand_separator: " ",
  decimal_separator: ",",
};

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={freshClient()}>
        <RegionalFormatsPage />
        <RetroToaster />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe("RegionalFormatsPage — formats (SETT-06)", () => {
  it("submits ONLY the dirty field (date_format) as a partial PATCH", async () => {
    let patchedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME)),
      http.patch(PREFS_PATH, async ({ request }) => {
        patchedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...ME, date_format: "DD/MM/YYYY" });
      }),
    );

    renderPage();
    const dateSel = await screen.findByLabelText(/date format/i);
    await waitFor(() =>
      expect((dateSel as HTMLSelectElement).value).toBe("YYYY-MM-DD"),
    );

    await userEvent.selectOptions(dateSel, "DD/MM/YYYY");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(patchedBody).not.toBeNull());
    expect(patchedBody).toEqual({ date_format: "DD/MM/YYYY" });
    expect(
      await screen.findByText(/changes saved\.|saved\./i),
    ).toBeInTheDocument();
  });

  it("blocks save with an inline error when thousand === decimal separator", async () => {
    let patched = false;
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME)),
      http.patch(PREFS_PATH, () => {
        patched = true;
        return HttpResponse.json(ME);
      }),
    );

    renderPage();
    // Make both separators a comma (decimal is already ",").
    const thousandSel = await screen.findByLabelText(/thousand separator/i);
    await waitFor(() =>
      expect((thousandSel as HTMLSelectElement).value).toBe(" "),
    );
    await userEvent.selectOptions(thousandSel, ",");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(
        /thousand and decimal separators must be different/i,
      ),
    ).toBeInTheDocument();
    expect(patched).toBe(false);
  });

  it("recomputes the live preview when a select changes (before save)", async () => {
    server.use(http.get(ME_PATH, () => HttpResponse.json(ME)));

    renderPage();
    const preview = await screen.findByTestId("formats-preview");
    const dateSel = screen.getByLabelText(/date format/i);
    await waitFor(() =>
      expect((dateSel as HTMLSelectElement).value).toBe("YYYY-MM-DD"),
    );
    // Default preview shows ISO date.
    expect(within(preview).getByText(/2026-06-13/)).toBeInTheDocument();

    await userEvent.selectOptions(dateSel, "DD.MM.YYYY");
    // Preview recomputes locally, no backend round-trip.
    await waitFor(() =>
      expect(within(preview).getByText(/13\.06\.2026/)).toBeInTheDocument(),
    );
  });
});
