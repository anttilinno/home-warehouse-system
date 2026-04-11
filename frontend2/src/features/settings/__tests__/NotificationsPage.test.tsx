import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ToastProvider } from "@/components/retro/RetroToast";

vi.mock("@/lib/api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  setRefreshToken: vi.fn(),
}));

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "test@example.com",
      full_name: "Test User",
      has_password: true,
      is_active: true,
      date_format: "YYYY-MM-DD",
      time_format: "24h",
      thousand_separator: ",",
      decimal_separator: ".",
      language: "en",
      theme: "system",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    workspaceId: "ws-1",
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

i18n.load("en", {});
i18n.activate("en");

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <I18nProvider i18n={i18n}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </I18nProvider>
  );
}

import { NotificationsPage } from "../NotificationsPage";

describe("NotificationsPage", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProviders(<NotificationsPage />);
    expect(container).toBeTruthy();
  });
});
