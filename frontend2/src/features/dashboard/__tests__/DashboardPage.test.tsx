import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

// Mock @/lib/api
vi.mock("@/lib/api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  setRefreshToken: vi.fn(),
}));

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// EventSource mock (jsdom doesn't have it)
const mockClose = vi.fn();
const mockEventSourceInstances: Array<{
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  close: ReturnType<typeof vi.fn>;
}> = [];

global.EventSource = vi.fn().mockImplementation(() => {
  const instance = {
    onmessage: null as ((ev: MessageEvent) => void) | null,
    onerror: null as ((ev: Event) => void) | null,
    close: mockClose,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 0,
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2,
  };
  mockEventSourceInstances.push(instance);
  return instance;
}) as unknown as typeof EventSource;

import { get } from "@/lib/api";
import { StatPanel } from "../StatPanel";
import { DashboardPage } from "../DashboardPage";

const mockGet = vi.mocked(get);

const fakeStats = {
  total_items: 42,
  total_inventory: 100,
  total_locations: 3,
  total_containers: 7,
  active_loans: 2,
  overdue_loans: 0,
  low_stock_items: 1,
  total_categories: 5,
  total_borrowers: 4,
};

const defaultAuth = {
  workspaceId: "ws-1",
  isLoading: false,
  isAuthenticated: true,
  user: { id: "u1", full_name: "Test" },
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

// Setup lingui for tests
i18n.load("en", {});
i18n.activate("en");

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>
  );
}

describe("StatPanel", () => {
  it("renders the value as a large number and the label as uppercase text", () => {
    renderWithProviders(<StatPanel label="ITEMS" value={42} />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("ITEMS")).toBeInTheDocument();
  });

  it('renders "---" when value is null (loading state)', () => {
    renderWithProviders(<StatPanel label="ITEMS" value={null} />);

    expect(screen.getByText("---")).toBeInTheDocument();
    expect(screen.getByText("ITEMS")).toBeInTheDocument();
  });

  it("has an aria-label with label and value", () => {
    renderWithProviders(<StatPanel label="ITEMS" value={42} />);

    expect(screen.getByLabelText("ITEMS: 42")).toBeInTheDocument();
  });

  it("has an aria-label with just label when value is null", () => {
    renderWithProviders(<StatPanel label="ITEMS" value={null} />);

    expect(screen.getByLabelText("ITEMS")).toBeInTheDocument();
  });
});

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventSourceInstances.length = 0;
    mockUseAuth.mockReturnValue(defaultAuth);
  });

  it("fetches dashboard stats on mount and renders 3 stat panels", async () => {
    mockGet.mockResolvedValueOnce(fakeStats); // analytics/dashboard
    mockGet.mockResolvedValueOnce([]); // analytics/activity

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    expect(screen.getByText("5")).toBeInTheDocument(); // total_categories
    expect(screen.getByText("3")).toBeInTheDocument(); // total_locations
    expect(mockGet).toHaveBeenCalledWith(
      "/workspaces/ws-1/analytics/dashboard"
    );
  });

  it('shows "---" in stat panels while loading', () => {
    // get never resolves
    mockGet.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<DashboardPage />);

    const dashes = screen.getAllByText("---");
    expect(dashes.length).toBe(3);
  });

  it("redirects to /setup when workspaceId is null and isLoading is false", () => {
    mockUseAuth.mockReturnValue({
      ...defaultAuth,
      workspaceId: null,
    });

    renderWithProviders(<DashboardPage />);

    expect(mockNavigate).toHaveBeenCalledWith("/setup", { replace: true });
  });
});
