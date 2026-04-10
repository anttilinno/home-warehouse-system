import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { RequireAuth } from "../RequireAuth";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Helper to capture navigation
function TestRoutes({ initialEntries }: { initialEntries: string[] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <RequireAuth>
        <div data-testid="protected">Protected Content</div>
      </RequireAuth>
    </MemoryRouter>
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("when authenticated, renders children", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(<TestRoutes initialEntries={["/dashboard"]} />);

    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("when not authenticated and not loading, redirects to /login", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    const { container } = render(
      <TestRoutes initialEntries={["/dashboard"]} />
    );

    // Should not render children
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    // Navigate component renders nothing visible
    expect(container.innerHTML).toBe("");
  });

  it("when loading, renders nothing", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    const { container } = render(
      <TestRoutes initialEntries={["/dashboard"]} />
    );

    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");
  });

  it("passes current location in state.from for post-login redirect", () => {
    // We use a more detailed test: render with Routes to capture Navigate's target
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    let capturedState: unknown = null;

    // Use Routes to capture the redirect
    const { Route, Routes } = require("react-router");

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <div>Settings</div>
              </RequireAuth>
            }
          />
          <Route
            path="/login"
            element={
              <LoginCapture
                onCapture={(state: unknown) => {
                  capturedState = state;
                }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(capturedState).toBeTruthy();
    expect((capturedState as { from: { pathname: string } }).from.pathname).toBe(
      "/settings"
    );
  });
});

// Helper component to capture location state
function LoginCapture({ onCapture }: { onCapture: (state: unknown) => void }) {
  const { useLocation } = require("react-router");
  const location = useLocation();
  onCapture(location.state);
  return <div>Login Page</div>;
}
