import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";

let authState = { isAuthenticated: false, isLoading: false };

vi.mock("../AuthContext", () => ({
  useAuth: () => authState,
}));

import { RequireAuth } from "../RequireAuth";

function LoginPage() {
  return <div data-testid="login-page">Login</div>;
}

describe("RequireAuth", () => {
  it("when authenticated, renders children", () => {
    authState = { isAuthenticated: true, isLoading: false };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <div data-testid="protected">Protected Content</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("protected")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("when not authenticated and not loading, redirects to /login", () => {
    authState = { isAuthenticated: false, isLoading: false };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <div data-testid="protected">Protected Content</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });

  it("when loading, renders nothing", () => {
    authState = { isAuthenticated: false, isLoading: true };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <div data-testid="protected">Protected Content</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("passes current location in state.from for post-login redirect", () => {
    authState = { isAuthenticated: false, isLoading: false };

    let capturedState: unknown = null;

    function LoginCapture() {
      const location = useLocation();
      capturedState = location.state;
      return <div data-testid="login-capture">Login</div>;
    }

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
          <Route path="/login" element={<LoginCapture />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("login-capture")).toBeInTheDocument();
    expect(capturedState).toBeTruthy();
    expect(
      (capturedState as { from: { pathname: string } }).from.pathname
    ).toBe("/settings");
  });
});
