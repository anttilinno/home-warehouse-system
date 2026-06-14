import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { PhotoUpload } from "./PhotoUpload";

// Phase 7 Plan 04 Task 1 — PhotoUpload pipeline: validate → compress →
// check-duplicate → upload, per-file progress + retry, dup-check gate. jsdom has
// no canvas, so compressImage is mocked to a pass-through File; the network
// (checkDuplicate/upload multipart) is exercised through MSW so the FormData
// field name "photo" is asserted on the real request.

vi.mock("@/lib/utils/image", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/image")>(
    "@/lib/utils/image",
  );
  return {
    ...actual,
    // Pass-through: jsdom has no canvas. validateUploadFile stays real.
    compressImage: vi.fn(async (file: File) => file),
  };
});

const WS = "ws-1";
const IT = "it-1";
const CHECK_PATH = `/api/workspaces/${WS}/items/${IT}/photos/check-duplicate`;
const UPLOAD_PATH = `/api/workspaces/${WS}/items/${IT}/photos`;

function makeFile(name: string, type: string): File {
  // String content (not a typed array) so undici's multipart parser in MSW can
  // re-read request.formData() without choking (matches 07-01 photos.test.ts).
  return new File(["x"], name, { type });
}

function renderUpload() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <PhotoUpload wsId={WS} itemId={IT} open onClose={() => {}} />
          <RetroToaster />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

async function pickFile(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  await userEvent.upload(input, file);
}

describe("PhotoUpload", () => {
  it("uploads a webp via FormData field 'photo' (no duplicate)", async () => {
    server.use(
      http.post(CHECK_PATH, () =>
        HttpResponse.json({ has_duplicates: false, duplicates: [] }),
      ),
    );
    // Read the raw multipart body as text and assert the field name. undici's
    // FormData re-parser chokes on a re-streamed body, so we inspect the wire
    // bytes directly (the Content-Disposition header carries `name="photo"`).
    let rawBody = "";
    server.use(
      http.post(UPLOAD_PATH, async ({ request }) => {
        rawBody = await request.text();
        return HttpResponse.json({});
      }),
    );

    renderUpload();
    await pickFile(makeFile("shelf.webp", "image/webp"));

    await waitFor(() => expect(screen.getByText("DONE")).toBeInTheDocument());
    // The load-bearing contract (plan Task 1): the multipart field is "photo".
    expect(rawBody).toContain('name="photo"');
    expect(screen.getByText("1/1 uploaded")).toBeInTheDocument();
  });

  it("rejects a HEIC file client-side before any upload", async () => {
    let checked = false;
    server.use(
      http.post(CHECK_PATH, () => {
        checked = true;
        return HttpResponse.json({ has_duplicates: false, duplicates: [] });
      }),
    );

    renderUpload();
    // Bypass the input's `accept` filter so validateUploadFile (the
    // defense-in-depth client gate) is what rejects the HEIC, not the browser.
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeFile("phone.heic", "image/heic"), {
      applyAccept: false,
    });

    await waitFor(() => expect(screen.getByText("FAILED")).toBeInTheDocument());
    expect(checked).toBe(false);
    expect(
      screen.getByText("That file type isn't allowed."),
    ).toBeInTheDocument();
  });

  it("opens the duplicate dialog; UPLOAD ANYWAY proceeds", async () => {
    server.use(
      http.post(CHECK_PATH, () =>
        HttpResponse.json({
          has_duplicates: true,
          duplicates: [
            {
              photo_id: "p-9",
              item_id: IT,
              filename: "old.webp",
              similarity_pct: 92,
              thumbnail_url: "http://localhost:8080/x/thumb",
            },
          ],
        }),
      ),
      http.post(UPLOAD_PATH, () => HttpResponse.json({})),
    );

    renderUpload();
    await pickFile(makeFile("dup.webp", "image/webp"));

    await waitFor(() =>
      expect(screen.getByText("POSSIBLE DUPLICATE")).toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /upload anyway/i }),
    );
    await waitFor(() => expect(screen.getByText("DONE")).toBeInTheDocument());
  });

  it("CANCEL on the duplicate dialog skips the file (no upload)", async () => {
    let uploaded = false;
    server.use(
      http.post(CHECK_PATH, () =>
        HttpResponse.json({
          has_duplicates: true,
          duplicates: [
            {
              photo_id: "p-9",
              item_id: IT,
              filename: "old.webp",
              similarity_pct: 88,
            },
          ],
        }),
      ),
      http.post(UPLOAD_PATH, () => {
        uploaded = true;
        return HttpResponse.json({});
      }),
    );

    renderUpload();
    await pickFile(makeFile("dup.webp", "image/webp"));

    await waitFor(() =>
      expect(screen.getByText("POSSIBLE DUPLICATE")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => expect(screen.getByText("FAILED")).toBeInTheDocument());
    expect(uploaded).toBe(false);
  });

  it("shows RETRY on a failed upload and retries on click", async () => {
    server.use(
      http.post(CHECK_PATH, () =>
        HttpResponse.json({ has_duplicates: false, duplicates: [] }),
      ),
    );
    let attempt = 0;
    server.use(
      http.post(UPLOAD_PATH, () => {
        attempt += 1;
        if (attempt === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({});
      }),
    );

    renderUpload();
    await pickFile(makeFile("retry.webp", "image/webp"));

    await waitFor(() => expect(screen.getByText("FAILED")).toBeInTheDocument());
    // Exact name: RetroFileInput renders a "Remove retry.webp" button whose
    // label also contains "retry" — the RETRY action button is the exact one.
    await userEvent.click(screen.getByRole("button", { name: "RETRY" }));
    await waitFor(() => expect(screen.getByText("DONE")).toBeInTheDocument());
    expect(attempt).toBe(2);
  });
});
