import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  useMutation,
} from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { retroToast } from "@/components/retro";
import { useResumeOnReconnect } from "./useResumeOnReconnect";

// The default MSW handlers (src/test/msw/handlers.ts) already register a
// 200 GET /api/users/me/workspaces — the cheapest authed probe this hook
// reuses — so no per-test handler override is needed for the happy path.

function Host({ onMutationReady }: { onMutationReady: (m: unknown) => void }) {
  useResumeOnReconnect();
  const mutation = useMutation({
    mutationKey: ["test", "reconnect-write"],
    mutationFn: async () => "ok",
  });
  onMutationReady(mutation);
  return null;
}

function renderHost(
  client: QueryClient,
  onMutationReady: (m: unknown) => void,
) {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <Host onMutationReady={onMutationReady} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("useResumeOnReconnect — sync toast", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  afterEach(() => {
    onlineManager.setOnline(true); // restore the default for later tests
    vi.restoreAllMocks();
  });

  it("shows a loading toast then resolves to success once a paused mutation drains on reconnect", async () => {
    const loadingSpy = vi
      .spyOn(retroToast, "loading")
      .mockReturnValue("toast-1");
    const successSpy = vi
      .spyOn(retroToast, "success")
      .mockReturnValue("toast-1");

    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    // biome-ignore lint/suspicious/noExplicitAny: test double, shape not needed
    let mutation: any;
    renderHost(client, (m) => {
      mutation = m;
    });

    onlineManager.setOnline(false);
    mutation.mutate();
    await waitFor(() => expect(mutation.isPaused).toBe(true));

    onlineManager.setOnline(true);

    await waitFor(() => expect(loadingSpy).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(successSpy).toHaveBeenCalledWith(expect.anything(), {
        id: "toast-1",
      }),
    );
  });
});
