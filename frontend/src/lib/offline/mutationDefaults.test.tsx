import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  useMutation,
} from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { http, HttpResponse } from "msw";
import { i18n } from "@/lib/i18n";
import { retroToast } from "@/components/retro";
import { server } from "@/test/msw/server";
import { registerMutationDefaults } from "./mutationDefaults";
import { MK } from "./mutationKeys";

// A3 (OFFLINE-PWA-V2-PLAN.md) — a queued create that fails on drain AFTER a
// reload must not fail silently: mutationDefaults.ts's onError is the ONLY
// code that runs on a resumed paused mutation (no hook mounted), so it owns
// surfacing the toast.

function Host({ onMutationReady }: { onMutationReady: (m: unknown) => void }) {
  const mutation = useMutation({ mutationKey: MK.itemCreate });
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

describe("mutationDefaults — onError replay-failure toast (A3)", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  afterEach(() => {
    onlineManager.setOnline(true); // restore the default for later tests
    vi.restoreAllMocks();
  });

  it("toasts an error and still invalidates the item list when the drained create rejects", async () => {
    server.use(
      http.post("/api/workspaces/:wsId/items", () =>
        HttpResponse.json({ message: "conflict" }, { status: 409 }),
      ),
    );
    const errorSpy = vi.spyOn(retroToast, "error").mockReturnValue("toast-1");

    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    registerMutationDefaults(client);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    // biome-ignore lint/suspicious/noExplicitAny: test double, shape not needed
    let mutation: any;
    renderHost(client, (m) => {
      mutation = m;
    });

    onlineManager.setOnline(false);
    mutation.mutate({
      wsId: "ws-1",
      idemKey: "idem-1",
      body: { name: "Cordless Drill" },
    });
    await waitFor(() => expect(mutation.isPaused).toBe(true));

    onlineManager.setOnline(true);
    await client.resumePausedMutations();

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        'Couldn\'t sync "Cordless Drill" — it may have been removed.',
      ),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["items", "ws-1"],
    });
  });
});
