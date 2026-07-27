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
import { locationPhotosApi } from "@/lib/api/locationPhotos";
import { registerMutationDefaults } from "./mutationDefaults";
import { MK } from "./mutationKeys";
import { getCapturePhoto, putCapturePhoto } from "./photoStore";

// A3 (OFFLINE-PWA-V2-PLAN.md) — a queued create that fails on drain AFTER a
// reload must not fail silently: mutationDefaults.ts's onError is the ONLY
// code that runs on a resumed paused mutation (no hook mounted), so it owns
// surfacing the toast.

function Host({ onMutationReady }: { onMutationReady: (m: unknown) => void }) {
  const mutation = useMutation({ mutationKey: MK.itemCreate });
  onMutationReady(mutation);
  return null;
}

function CaptureHost({
  onMutationReady,
}: {
  onMutationReady: (m: unknown) => void;
}) {
  const mutation = useMutation({ mutationKey: MK.captureCreate });
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

// A capture's photo used to ride along in the mutation variables as a File.
// The persister serialises with JSON.stringify, so a reload while offline
// restored the capture with `photo: undefined` and the image was gone with no
// error. The bytes now live in an idb side-store keyed by `photoId`, which is
// a string and therefore survives that round trip.
describe("mutationDefaults — a queued capture photo survives the persister", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
  });

  it("uploads the photo after the vars have been through JSON round-tripping", async () => {
    server.use(
      http.post("/api/workspaces/:wsId/locations", () =>
        HttpResponse.json({ id: "loc-1", name: "Shelf A" }),
      ),
    );
    // Spied at the api-client boundary rather than asserted off the multipart
    // body: the File reaches this call in-process, whereas an MSW handler sees
    // it across a realm boundary that mangles it in jsdom.
    const uploadSpy = vi
      .spyOn(locationPhotosApi, "upload")
      .mockResolvedValue({} as never);

    const photoId = "capture-photo-1";
    await putCapturePhoto(
      photoId,
      new File(["abc"], "shelf.jpg", { type: "image/jpeg" }),
    );

    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    registerMutationDefaults(client);

    // biome-ignore lint/suspicious/noExplicitAny: test double, shape not needed
    let mutation: any;
    render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <CaptureHost onMutationReady={(m) => (mutation = m)} />
        </QueryClientProvider>
      </I18nProvider>,
    );

    // THE point of the test: what the persister would hand back after a
    // reload, not the in-memory object. A File here would arrive as `{}`.
    const restored = JSON.parse(
      JSON.stringify({
        wsId: "ws-1",
        idemKey: "idem-1",
        kind: "location",
        body: { name: "Shelf A" },
        photoId,
      }),
    );
    expect(restored.photoId).toBe(photoId);

    mutation.mutate(restored);

    await waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(1));
    const [wsId, locationId, file] = uploadSpy.mock.calls[0];
    expect([wsId, locationId]).toEqual(["ws-1", "loc-1"]);
    // Name, type and bytes all came back out of the side-store intact.
    expect(file.name).toBe("shelf.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(await file.text()).toBe("abc");

    // Settled for good — the side-store must not keep the bytes forever.
    await waitFor(async () =>
      expect(await getCapturePhoto(photoId)).toBeUndefined(),
    );
  });
});
