import { type ReactNode } from "react";
import {
  render,
  renderHook,
  type RenderResult,
  type RenderHookResult,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Creates a QueryClient configured for tests: retries disabled, gcTime
 * capped so unmounted queries don't linger. Use a FRESH client per test to
 * avoid cross-test cache bleed.
 *
 * Phase 65 Plan 01 Task 1 — referenced by Plan 02+ query-backed tests.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Renders a component inside a fresh QueryClientProvider.
 * Returns the RTL render result plus the client so tests can inspect the
 * cache (e.g. `vi.spyOn(client, "invalidateQueries")`).
 */
export function renderWithQueryClient(
  ui: ReactNode,
  options?: { client?: QueryClient },
): RenderResult & { client: QueryClient } {
  const client = options?.client ?? createTestQueryClient();
  const result = render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
  return { ...result, client };
}

/**
 * Renders a hook inside a fresh QueryClientProvider — mirrors
 * @testing-library/react's `renderHook` signature but guarantees a provider.
 */
export function renderHookWithQueryClient<Result, Props>(
  hook: (initialProps: Props) => Result,
  options?: { client?: QueryClient; initialProps?: Props },
): RenderHookResult<Result, Props> & { client: QueryClient } {
  const client = options?.client ?? createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const result = renderHook(hook, {
    wrapper,
    initialProps: options?.initialProps,
  });
  return { ...result, client };
}
