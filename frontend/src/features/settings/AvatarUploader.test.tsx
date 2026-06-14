import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { AvatarUploader } from "./AvatarUploader";

// Phase 12 Plan 03 — AvatarUploader (SETT-02). A dedicated single-file
// multipart uploader (NOT PhotoUpload). The avatar field name MUST be "avatar"
// (handler.go:694 r.FormFile("avatar")); the preview is cache-busted with the
// ["me"] query's dataUpdatedAt to defeat the stable avatar_url cache (Pitfall 7).

const ME_PATH = "/api/users/me";
const AVATAR_PATH = "/api/users/me/avatar";

const ME_NO_AVATAR = {
  id: "user-1",
  email: "seeder@test.local",
  full_name: "Seed Er",
  avatar_url: null,
  has_password: true,
};

const ME_WITH_AVATAR = {
  ...ME_NO_AVATAR,
  avatar_url: "/api/users/me/avatar",
};

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderUploader() {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={freshClient()}>
        <ModalStackProvider>
          <AvatarUploader />
          <RetroToaster />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
});

describe("AvatarUploader (SETT-02)", () => {
  it("renders a 150×150 initials placeholder when there is no avatar", async () => {
    server.use(http.get(ME_PATH, () => HttpResponse.json(ME_NO_AVATAR)));

    renderUploader();

    // Initials of "Seed Er" → "SE". No broken <img>.
    expect(await screen.findByText("SE")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a cache-busted <img> when avatar_url is present", async () => {
    server.use(http.get(ME_PATH, () => HttpResponse.json(ME_WITH_AVATAR)));

    renderUploader();

    const img = await screen.findByRole("img");
    // src must carry the avatar_url AND a ?v= cache-bust query.
    expect(img.getAttribute("src")).toContain("/api/users/me/avatar");
    expect(img.getAttribute("src")).toMatch(/\?v=/);
  });

  it("upload sends multipart field 'avatar' and invalidates ['me']", async () => {
    // undici's FormData re-parser chokes on a re-streamed body in jsdom, so we
    // inspect the wire bytes directly (the Content-Disposition header carries
    // `name="avatar"`) — the project idiom from PhotoUpload.test.tsx.
    let rawBody = "";
    let fetchCount = 0;
    server.use(
      http.get(ME_PATH, () => {
        fetchCount += 1;
        return HttpResponse.json(
          fetchCount === 1 ? ME_NO_AVATAR : ME_WITH_AVATAR,
        );
      }),
      http.post(AVATAR_PATH, async ({ request }) => {
        rawBody = await request.text();
        return HttpResponse.json(ME_WITH_AVATAR);
      }),
    );

    renderUploader();
    // Wait for the no-avatar placeholder first.
    await screen.findByText("SE");

    // String content (not a typed array) so undici's multipart parser cooperates.
    const file = new File(["x"], "me.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await userEvent.upload(input, file, { applyAccept: false });

    // The load-bearing contract: the multipart field MUST be "avatar".
    await waitFor(() => expect(rawBody).toContain('name="avatar"'));
    // ["me"] re-fetched (invalidation) → now an <img> renders.
    expect(await screen.findByRole("img")).toBeInTheDocument();
  });

  it("Remove opens a pink confirm and DELETEs the avatar, invalidating ['me']", async () => {
    let deleted = false;
    let fetchCount = 0;
    server.use(
      http.get(ME_PATH, () => {
        fetchCount += 1;
        return HttpResponse.json(
          fetchCount === 1 ? ME_WITH_AVATAR : ME_NO_AVATAR,
        );
      }),
      http.delete(AVATAR_PATH, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderUploader();
    await screen.findByRole("img");

    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^remove$/i }),
    );

    await waitFor(() => expect(deleted).toBe(true));
    // After invalidation the no-avatar placeholder returns.
    expect(await screen.findByText("SE")).toBeInTheDocument();
  });
});
