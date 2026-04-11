import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { vi } from "vitest";
import { TopBar } from "../TopBar";

// Setup lingui for tests
i18n.load("en", {});
i18n.activate("en");

const mockLogout = vi.fn();

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { full_name: "Test User", avatar_url: null },
    logout: mockLogout,
  }),
}));

function renderTopBar(props?: Partial<{ onMenuClick: () => void; drawerOpen: boolean }>) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <TopBar onMenuClick={vi.fn()} drawerOpen={false} {...props} />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("TopBar", () => {
  beforeEach(() => {
    mockLogout.mockReset();
  });

  it("renders a header element", () => {
    renderTopBar();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("displays HOME WAREHOUSE app title", () => {
    renderTopBar();
    expect(screen.getByText("HOME WAREHOUSE")).toBeInTheDocument();
  });

  it("displays user full_name from useAuth", () => {
    renderTopBar();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("displays avatar initial when avatar_url is null (first letter of full_name, uppercase)", () => {
    renderTopBar();
    // First letter of "Test User" is "T"
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("displays avatar img when avatar_url is provided", () => {
    renderTopBar();
    // With null avatar_url, no img should render
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders a logout button with text LOGOUT", () => {
    renderTopBar();
    expect(screen.getByRole("button", { name: /LOGOUT/i })).toBeInTheDocument();
  });

  it("calls useAuth().logout when logout button is clicked", async () => {
    const user = userEvent.setup();
    renderTopBar();
    const logoutBtn = screen.getByRole("button", { name: /LOGOUT/i });
    await user.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
