import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { UpcSuggestionBanner } from "./UpcSuggestionBanner";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function mockProduct(body: Record<string, unknown>) {
  server.use(http.get("*/barcode/:code", () => HttpResponse.json(body)));
}

function renderBanner(
  code: string,
  { onUse = vi.fn(), onDismiss = vi.fn() } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <UpcSuggestionBanner code={code} onUse={onUse} onDismiss={onDismiss} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { onUse, onDismiss };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("UpcSuggestionBanner", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
    useWorkspaceMock.mockReturnValue({
      currentWorkspaceId: "ws-A",
      setWorkspace: vi.fn(),
      workspaces: [],
      isLoading: false,
    });
  });

  it("renders nothing for a non-numeric / too-short code", () => {
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <UpcSuggestionBanner
            code="ABC-128"
            onUse={vi.fn()}
            onDismiss={vi.fn()}
          />
        </QueryClientProvider>
      </I18nProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("found product renders the banner with name/brand + 3 buttons", async () => {
    mockProduct({
      barcode: "0123456789012",
      name: "Bosch Cordless Drill",
      brand: "Bosch",
      found: true,
    });
    renderBanner("0123456789012");
    expect(
      await screen.findByText("Bosch Cordless Drill — Bosch"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /USE NAME/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /USE ALL/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /DISMISS/ })).toBeInTheDocument();
  });

  it("found:false suppresses the banner", async () => {
    mockProduct({ barcode: "0123456789012", name: "", found: false });
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <UpcSuggestionBanner
            code="0123456789012"
            onUse={vi.fn()}
            onDismiss={vi.fn()}
          />
        </QueryClientProvider>
      </I18nProvider>,
    );
    // Give the query a tick to settle; the banner must never render.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("USE NAME emits { name } only", async () => {
    mockProduct({
      barcode: "0123456789012",
      name: "Bosch Cordless Drill",
      brand: "Bosch",
      found: true,
    });
    const { onUse } = renderBanner("0123456789012");
    await userEvent.click(
      await screen.findByRole("button", { name: /USE NAME/ }),
    );
    expect(onUse).toHaveBeenCalledExactlyOnceWith({
      name: "Bosch Cordless Drill",
    });
  });

  it("USE ALL emits { name, brand }", async () => {
    mockProduct({
      barcode: "0123456789012",
      name: "Bosch Cordless Drill",
      brand: "Bosch",
      found: true,
    });
    const { onUse } = renderBanner("0123456789012");
    await userEvent.click(
      await screen.findByRole("button", { name: /USE ALL/ }),
    );
    expect(onUse).toHaveBeenCalledExactlyOnceWith({
      name: "Bosch Cordless Drill",
      brand: "Bosch",
    });
  });

  it("DISMISS emits onDismiss", async () => {
    mockProduct({
      barcode: "0123456789012",
      name: "Bosch Cordless Drill",
      found: true,
    });
    const { onDismiss } = renderBanner("0123456789012");
    await userEvent.click(
      await screen.findByRole("button", { name: /DISMISS/ }),
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
