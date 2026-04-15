import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ToastProvider } from "@/components/retro";
import type { Category } from "@/lib/api/categories";
import type { Location } from "@/lib/api/locations";
import type { Container } from "@/lib/api/containers";
import { vi } from "vitest";

// Initialise Lingui once per test process with an empty English catalog.
// Matches pattern used in RetroConfirmDialog.test.tsx.
i18n.load("en", {});
i18n.activate("en");

const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

// Minimal auth shape seeded into tests. Real AuthContext lives in
// src/features/auth/AuthContext — feature tests only need workspaceId + flags.
export interface TestAuthValue {
  workspaceId: string;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const TestAuthContext = createContext<TestAuthValue | null>(null);

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  workspaceId?: string;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const {
    workspaceId = DEFAULT_WORKSPACE_ID,
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    }),
    ...rest
  } = options;

  const auth: TestAuthValue = {
    workspaceId,
    isLoading: false,
    isAuthenticated: true,
  };

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <TestAuthContext.Provider value={auth}>
          <ToastProvider>{children}</ToastProvider>
        </TestAuthContext.Provider>
      </I18nProvider>
    </QueryClientProvider>
  );

  const result = render(ui, { wrapper: Wrapper, ...rest });
  return { ...result, queryClient };
}

/**
 * Mock HTMLDialogElement.prototype.showModal / close so tests that render
 * RetroConfirmDialog (which uses native <dialog>) work under jsdom.
 * Call inside beforeEach.
 */
export function setupDialogMocks(): void {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
}

// ---------- Entity factories ----------

const NOW = "2026-04-16T00:00:00Z";

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: overrides.id ?? "11111111-1111-1111-1111-111111111111",
    workspace_id: overrides.workspace_id ?? DEFAULT_WORKSPACE_ID,
    name: overrides.name ?? "Electronics",
    parent_category_id: overrides.parent_category_id ?? null,
    description: overrides.description ?? null,
    is_archived: overrides.is_archived ?? false,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    ...overrides,
  };
}

export function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: overrides.id ?? "22222222-2222-2222-2222-222222222222",
    workspace_id: overrides.workspace_id ?? DEFAULT_WORKSPACE_ID,
    name: overrides.name ?? "Garage",
    parent_location: overrides.parent_location ?? null,
    description: overrides.description ?? null,
    short_code: overrides.short_code ?? "GAR-001",
    is_archived: overrides.is_archived ?? false,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    ...overrides,
  };
}

export function makeContainer(overrides: Partial<Container> = {}): Container {
  return {
    id: overrides.id ?? "33333333-3333-3333-3333-333333333333",
    workspace_id: overrides.workspace_id ?? DEFAULT_WORKSPACE_ID,
    name: overrides.name ?? "Shelf A",
    location_id: overrides.location_id ?? "22222222-2222-2222-2222-222222222222",
    description: overrides.description ?? null,
    capacity: overrides.capacity ?? null,
    short_code: overrides.short_code ?? "SHA-001",
    is_archived: overrides.is_archived ?? false,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    ...overrides,
  };
}
