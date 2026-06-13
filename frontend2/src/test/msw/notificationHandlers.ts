import { http, HttpResponse } from "msw";
import type { NotificationDTO } from "@/lib/api/notifications";

// Phase 13 Plan 01 — MSW notification handlers for the mutation + bell tests.
// USER-scoped: routes match at `/api/notifications/...` with NO {ws} segment.
// list/unread return the { items, total, page, total_pages } envelope; the
// unread/count route returns { count }; the read POSTs return 204. Specific
// routes (read-all, unread/count, unread, {id}/read) are declared BEFORE the
// list catch-all so they win.
//
// Per-case overrides via `server.use(...)` — NOT registered in global handlers.ts.

export const NOTIF_UNREAD: NotificationDTO = {
  id: "notif-1",
  user_id: "user-1",
  notification_type: "LOAN_DUE_SOON",
  title: "Loan due soon",
  message: "Your drill is due back tomorrow.",
  is_read: false,
  created_at: "2026-06-12T09:00:00Z",
};

export const NOTIF_READ: NotificationDTO = {
  id: "notif-2",
  user_id: "user-1",
  notification_type: "SYSTEM",
  title: "Welcome",
  message: "Thanks for joining.",
  is_read: true,
  read_at: "2026-06-10T08:00:00Z",
  created_at: "2026-06-10T08:00:00Z",
};

export const ALL_NOTIFS = [NOTIF_UNREAD, NOTIF_READ];

function listEnvelope(items: NotificationDTO[]) {
  return { items, total: items.length, page: 1, total_pages: 1 };
}

export const notificationHandlers = [
  // --- writes (specific routes BEFORE the list catch-all) ---
  http.post(
    "/api/notifications/read-all",
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post(
    "/api/notifications/:id/read",
    () => new HttpResponse(null, { status: 204 }),
  ),

  // --- reads ---
  http.get("/api/notifications/unread/count", () =>
    HttpResponse.json({ count: 1 }),
  ),
  http.get("/api/notifications/unread", () =>
    HttpResponse.json(listEnvelope([NOTIF_UNREAD])),
  ),
  http.get("/api/notifications", () => HttpResponse.json(listEnvelope(ALL_NOTIFS))),
];
