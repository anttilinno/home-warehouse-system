import "@testing-library/jest-dom";
// Shared test utilities for auth tests

import { ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router";

interface WrapperProps {
  children: ReactNode;
}

export function createRouterWrapper(initialEntries: string[] = ["/"]) {
  return function RouterWrapper({ children }: WrapperProps) {
    return (
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    );
  };
}

export function renderWithRouter(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { initialEntries?: string[] }
) {
  const { initialEntries = ["/"], ...renderOptions } = options ?? {};
  return render(ui, {
    wrapper: createRouterWrapper(initialEntries),
    ...renderOptions,
  });
}
