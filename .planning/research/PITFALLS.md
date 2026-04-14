# Pitfalls: v2.1 Feature Parity (Items, Loans, Scanning, Categories/Locations)

**Domain:** Porting CRUD + photos + barcode + loans from `/frontend` (Next.js/shadcn) to `/frontend2` (Vite + React 19 + retro component library)
**Researched:** 2026-04-14
**Confidence:** HIGH (project-specific, grounded in shipped v1.3/v1.9 lessons from PROJECT.md)

## Context Snapshot

Retro library in `frontend2/src/components/retro/` today exposes: `HazardStripe, RetroBadge, RetroButton, RetroCard, RetroDialog, RetroInput, RetroPanel, RetroTable, RetroTabs, RetroToast`. Missing primitives that v2.1 needs: **Select/Combobox, Form wrapper, FileUpload/Dropzone, Pagination, Skeleton, Checkbox, Radio, Textarea, DatePicker, EmptyState, ConfirmDialog wrapper, Pill/Chip filter**. Every missing primitive is a pitfall vector — the path of least resistance is to reach for a headless lib mid-feature and break aesthetic consistency.

The backend (Go + Chi + sqlc) already serves frontend1; API shapes, pagination, and photo-upload semantics are frozen. Online-only means no IndexedDB/SyncManager code should appear in v2.1 — a tempting but wrong copy target from `/frontend`.

---

## Critical Pitfalls

### 1. Porting offline plumbing along with the feature code
**What goes wrong:** Developer copies `ItemsPage.tsx` from `/frontend` and drags along `useOfflineMutation`, `SyncManager`, IndexedDB writes, optimistic-queue helpers, conflict resolver hooks.
**Why it happens:** The original files are deeply interleaved with offline logic. A "port" feels like a copy, but v1.1/v1.9 wired offline into every mutation call site.
**Consequences:** Bundle bloat (idb, SyncManager, resolver), dead code paths, broken behavior when the offline modules are stubbed out, violates "lean online-only" constraint.
**Prevention:**
  - Before copying any page, grep the file for: `useOfflineMutation`, `SyncManager`, `idb`, `pendingChanges`, `dependsOn`, `needs_review`, `offlineQueue`. Rewrite those call sites to plain `fetch` / TanStack Query.
  - Treat `/frontend` as a *reference* (read it in a second pane), not a *source* (no `cp`).
  - Add a grep-based CI check in v2.1 that fails if `frontend2/src/**` imports `idb`, `serwist`, or files named `*offline*` / `*sync*`.
**Detection:** Bundle analyzer shows `idb` or `@serwist/*` in frontend2 output. CI grep check.
**Phase:** Items CRUD phase (first port) — set the precedent here.

### 2. Re-adopting `needs_review` / Quick Capture semantics that don't apply
**What goes wrong:** The v1.9 item model has `needs_review`, `QC-{timestamp}` SKU generator, batch session state. Porting items CRUD carries these fields into forms and lists.
**Why it happens:** Shared types/DTOs; the form field list in `/frontend` includes these.
**Consequences:** Confusing UI (a "Needs Review" toggle on a regular item form), test failures, data pollution for non-QC items.
**Prevention:** Explicitly enumerate the v2.1 item fields in the plan (name, SKU, category, location, container, quantity, photos, description, barcode). Anything else = out of scope. Quick Capture itself is out of scope for v2.1 (not in milestone goal).
**Phase:** Items CRUD phase.

### 3. iOS PWA camera permission reset on route navigation (barcode scanner)
**What goes wrong:** Scanner is rendered on `/scan` as a sub-component of a page that navigates to `/items/new` on "Item not found → create". iOS Safari revokes `getUserMedia` permission on route transition; returning to scanner re-prompts or silently fails.
**Why it happens:** Documented in PROJECT.md: *"iOS PWA camera permission persists within a single page/route"*. v1.3 already solved this via single-route scan flow.
**Consequences:** Users hit permission dialog every scan, camera black-screens, scanner unusable on installed iOS PWA.
**Prevention:**
  - Keep the scanner as a **single route** (e.g., `/scan`) with internal state machine: idle → scanning → matched | not-found → action-menu. Do NOT `navigate()` away until user explicitly exits.
  - Render "create item" as a sheet/dialog overlay on the scan route, not a route push, OR stop the camera stream deliberately before navigating.
  - On unmount, explicitly call `stream.getTracks().forEach(t => t.stop())` — leaked tracks also trigger iOS re-permission.
  - Test matrix must include: installed iOS PWA (not just Safari tab) + second scan after first scan.
**Detection:** Second-scan permission prompt on iOS 17+. `getUserMedia` throws `NotAllowedError` after navigation.
**Phase:** Barcode scanning phase.

### 4. Photo upload: no size/type guard → 413 or memory blowup
**What goes wrong:** User picks a 12 MB HEIC from iPhone camera roll. Frontend POSTs raw file. Backend rejects (413), or frontend reads into memory for preview and crashes the tab on older iPhones.
**Why it happens:** No client-side validation layer exists in frontend2 yet (no FileUpload primitive). Developer wires `<input type="file">` directly.
**Consequences:** Silent upload failures, bad UX, OOM on low-end devices, server log noise.
**Prevention:**
  - Enforce client-side: max size (match backend `itemphoto` limit — verify, likely 10 MB), allowed MIME (`image/jpeg`, `image/png`, `image/webp`, `image/heic`).
  - Downscale to max 2048px longest edge via `<canvas>` or `createImageBitmap` **before** upload (reuse pattern from v1.9 CapturePhotoStrip).
  - Strip EXIF orientation by drawing to canvas (HEIC/iPhone photos arrive sideways otherwise).
  - Use `URL.createObjectURL` for previews and `revokeObjectURL` on unmount — stale closure bug from v1.9 (see Tech Debt in PROJECT.md) is a known trap; use useEffect cleanup with a ref to current blob URLs, not the closure-captured list.
  - Upload as `multipart/form-data`, one request per photo, sequential (not parallel × 5) to avoid mobile network stalls.
**Detection:** Server 413s; iOS Safari tab reloads during preview; rotated thumbnails.
**Phase:** Items CRUD (photo sub-phase).

### 5. API pagination mismatch — "load all items" anti-pattern
**What goes wrong:** Developer ports the list page, calls `GET /items` without pagination params, renders 2,000 rows in a `RetroTable`.
**Why it happens:** In dev with 10 seed items it works fine; pagination is invisible. Backend likely uses cursor or limit/offset — if the request omits params, default may be 25 or unlimited depending on endpoint.
**Consequences:** Slow first paint, jank, hidden data (user thinks they have 25 items when they have 2,000), broken loan history.
**Prevention:**
  - Before building the list page, document the exact pagination contract per endpoint (`/items`, `/loans`, `/categories`, `/locations`) — query params, response envelope (`{data, nextCursor, total}` vs `{items, page, pageSize, total}`), default limit.
  - Pick ONE client pattern: TanStack Query `useInfiniteQuery` (preferred for mobile / retro terminal feel) OR numbered pagination (`RetroButton` prev/next + page indicator). Don't mix.
  - Add an explicit "showing N of M" line in the UI — regression canary for truncation.
  - Server-side filter/search from day one (don't fetch-all-then-filter). Categories/locations may be small enough to fetch fully, but put a hard cap (e.g., 500) and surface a warning if exceeded.
**Detection:** Network tab shows a single `GET /items` with no `limit` param; response > 200 KB.
**Phase:** Items CRUD, Loans.

### 6. Form state chaos without a Form primitive
**What goes wrong:** Each CRUD form hand-rolls `useState` per field, manual validation, ad-hoc error rendering. Item form has ~12 fields; loan form has ~8. Three developers, three patterns.
**Why it happens:** No `RetroForm` exists; shadcn's `<Form>` from `/frontend` is not portable (depends on react-hook-form + zod integration tied to shadcn styling).
**Consequences:** Inconsistent validation UX, duplicated code, "required" errors rendered differently per form, a11y regressions (no `aria-describedby` linking).
**Prevention:**
  - **Add react-hook-form + zod as the form substrate** (decision-level; both are headless, aesthetic-neutral, ~25 kB combined). Wrap `RetroInput` in a thin `RetroFormField` that wires `register` + error display.
  - Standardize error rendering once in `RetroFormField` (red stripe + `RetroBadge` "ERR" tag fits retro aesthetic).
  - Build item form FIRST as the reference implementation; loan/category/location/container forms copy the pattern.
  - Zod schemas live adjacent to API types; reuse for both form validation and API response parsing to catch backend drift.
**Phase:** Items CRUD (set the pattern), then reused downstream.

### 7. Missing Select/Combobox primitive → native `<select>` trap
**What goes wrong:** Category, location, container, and borrower pickers need searchable dropdowns with hundreds of options. Native `<select>` is used because it's fast to wire.
**Why it happens:** `RetroInput` exists but no `RetroSelect`. Native is styleable only superficially, and looks nothing like the retro aesthetic on iOS (system picker wheel).
**Consequences:** Aesthetic break, no search-in-dropdown, can't display hierarchy (categories/locations are hierarchical per v1.1), poor mobile UX.
**Prevention:**
  - Build `RetroSelect` (single) and `RetroCombobox` (searchable) as part of the milestone, **before** wiring forms. Use Radix `@radix-ui/react-popover` + custom trigger (headless, no styling imported) or `downshift` (~5 kB).
  - For hierarchical category/location pickers, render indented options with `└─` ASCII prefix (fits retro aesthetic) — do NOT build a tree widget in v2.1 (out of scope, deferred to later milestone).
  - Borrower picker is combobox (search by name). Category/location small enough for flat select with indent.
**Phase:** First phase (design-system extension) — blocks all CRUD forms.

### 8. Loan state machine drift between frontend and backend
**What goes wrong:** Frontend models loan as `{active, returned}` boolean; backend has `{pending, active, overdue, returned, cancelled}`. Filters, badges, and "Return" button logic break.
**Why it happens:** Copying a simplified mental model from UI copy instead of reading the DB schema / sqlc types.
**Consequences:** "Return" button shown on cancelled loans, overdue filter empty, timezone bugs on overdue calculation (server UTC vs client local).
**Prevention:**
  - Derive TS types from backend (sqlc generates JSON via tags; either hand-mirror into `frontend2/src/types/` or generate via `openapi-ts` if a spec exists).
  - Overdue is **computed server-side** — never compute `due_date < now()` on the client (timezone + clock skew).
  - Enumerate allowed state transitions in one place (`canReturn(loan)`, `canCancel(loan)`) and call it from every button.
**Phase:** Loan management.

### 9. Optimistic updates without the offline queue → stale UI on failure
**What goes wrong:** Developer writes TanStack Query `onMutate` optimistic updates copied from `/frontend`, but without the offline queue's rollback machinery they get orphan optimistic rows on 500 errors.
**Why it happens:** Offline-first patterns look the same as optimistic-update patterns — both use `onMutate`. `/frontend` wraps them in retry/queue semantics; stripping the queue leaves naked optimism.
**Consequences:** Ghost items in list after failed POST, user confusion, no retry path.
**Prevention:**
  - For v2.1: use TanStack Query's `onMutate` + `onError` rollback + `onSettled: invalidate`. Keep it vanilla.
  - Display mutation errors in `RetroToast` with action button "RETRY" that re-fires the mutation — replaces the offline-queue retry UX.
  - Don't show the row as "saved" until server responds. Retro aesthetic supports a "PENDING..." badge during flight; that's enough feedback.
**Phase:** Items CRUD (pattern), then all mutations.

---

## Moderate Pitfalls

### 10. Barcode scanner library version / React 19 compatibility
**What goes wrong:** `@yudiel/react-qr-scanner` version pinned in `/frontend` may not have a React 19 peer-dep bump; install succeeds but refs or effects misbehave.
**Prevention:** Verify the installed version explicitly supports React 19 (check package.json peerDeps and changelog). If not, pin the latest 2.x that works; file an issue if ref-forwarding breaks. Alternative: `html5-qrcode` (heavier, wider compat). Decision in the scanner phase, not improvised.
**Phase:** Barcode scanning.

### 11. `RetroDialog` used for both confirm and form modals → scroll/focus bugs
**What goes wrong:** Long item-create form rendered inside `RetroDialog` without scroll container; focus trap not implemented; Escape closes form and loses data.
**Prevention:**
  - Audit `RetroDialog` for: focus trap on open, Escape handler, scrollable body region, `aria-modal`. Fix once.
  - For item create/edit, prefer a full route (`/items/new`, `/items/:id/edit`) not a dialog — forms are too tall for mobile modals.
  - Dialog only for: delete confirm, quick actions menu, "item not found" prompt.
**Phase:** Items CRUD + design-system extension.

### 12. Photo gallery on item detail — lazy load and lightbox missing
**What goes wrong:** Item with 5 photos renders all full-size images on detail page. No lightbox → user can't see the actual photo content.
**Prevention:** Request thumbnail URLs from backend (v1.2 shipped background thumbnail processing — endpoint likely returns `photo.thumbnail_url`). Use `loading="lazy"` on non-first images. Lightbox: simple `RetroDialog` with keyboard arrow navigation, no third-party lib.
**Phase:** Items CRUD (detail view).

### 13. Category/location delete without cascade warning
**What goes wrong:** User deletes "Garage" location; 47 items go orphan or backend returns FK error; UI shows generic "Something went wrong".
**Prevention:** Before delete, GET count of dependent items and show in confirm: *"Garage contains 47 items — delete anyway? Items will be un-located."* Handle 409 with targeted error message. Decide cascade vs block policy with backend team per entity.
**Phase:** Categories & Locations.

### 14. Translation keys not added for new features (i18n drift)
**What goes wrong:** New strings hardcoded in English; Estonian/Russian users see mixed-language UI. Lingui extraction missed.
**Prevention:** All user-facing strings via `<Trans>` or `t` tagged template. Run `lingui extract` in CI and fail if untranslated keys appear outside a baseline allowlist. Add a task to each plan: "Extract + translate N new keys."
**Phase:** All phases.

### 15. Format hooks forgotten for dates/numbers
**What goes wrong:** Loan due dates rendered with raw `toLocaleDateString()`; ignores user's v1.6 format preference.
**Prevention:** Use `useDateFormat`, `useTimeFormat`, `useNumberFormat` from the existing format system (shipped v1.6). Grep review: no raw `toLocaleDateString`, `toLocaleTimeString`, `toLocaleString` in new code.
**Phase:** Loans, Items (quantity display).

### 16. Route structure not designed up-front → nested-route refactors mid-milestone
**What goes wrong:** `/items` starts as one flat route; later needs `/items/:id`, `/items/:id/edit`, `/items/:id/photos`. React Router v7 nested routes retrofitted awkwardly.
**Prevention:** Sketch the full route tree in the roadmap before phase 1. Use React Router v7's data-router (`createBrowserRouter` + loader/action or RQ-in-loader) consistently from the start.
**Phase:** Roadmap planning (pre-implementation).

---

## Minor Pitfalls

### 17. `RetroTable` column overflow on mobile
Item lists with 8 columns horizontal-scroll awkwardly. **Prevention:** Responsive variant — card list on `<md`, table on `≥md`. Build a `RetroItemCard` once, reuse for mobile list + loan history + scan results.

### 18. Barcode scanner audio feedback blocked by Safari autoplay
AudioContext not resumed from user gesture → silent scan beep on iOS. **Prevention:** Resume AudioContext on user tap that opens the scanner, not on first scan event. (v1.3 solved this; reuse the hook.)

### 19. Haptic feedback missing on retro frontend
`ios-haptics` is installed in `/frontend`. v2.1 must decide: port it or skip. **Prevention:** Port the hook (`useHaptic`) for scanner success beep and save confirmations — consistent with v1.3 UX expectations. Single file, negligible cost.

### 20. 16px font-size rule for mobile inputs
iOS zooms on focus if input font <16px. `RetroInput` must use `text-base` (16px) minimum. **Prevention:** Audit `RetroInput` CSS; add a visual regression test or lint rule.

### 21. Stale React Query cache across CRUD → users see old data after edit
Forgetting `queryClient.invalidateQueries(['items'])` after edit. **Prevention:** Centralize mutation helpers per entity (`useCreateItem`, `useUpdateItem`, `useDeleteItem`) that handle invalidation internally. Forms only call the hook, never touch `queryClient` directly.

### 22. File input `capture="environment"` not set for mobile
"Take photo" on mobile opens gallery instead of camera. **Prevention:** Two buttons — "Camera" (`capture="environment"`) and "Gallery" (no capture attr). Mirrors v1.9 UX.

### 23. EXIF orientation on uploaded photos
Already covered in Pitfall 4 but worth isolating: test with portrait iPhone photos; sideways display is the canary.

---

## Phase-Specific Warning Table

| Phase | Likely Pitfalls | Mitigation |
|-------|-----------------|------------|
| Design-system extension (Select, Combobox, Form, FileUpload, Pagination, Skeleton, EmptyState) | #7, #11 | Build primitives FIRST; block CRUD phases on these |
| Items CRUD | #1, #2, #4, #5, #6, #9, #12, #17, #22, #23 | Port without offline code; rhf+zod; thumbnail endpoint; size/EXIF guards |
| Photo upload (sub-phase) | #4, #22, #23 | Client-side resize + EXIF strip + capture attr + MIME allowlist |
| Barcode scanning | #3, #10, #18, #19 | Single-route scan flow; verify lib+React 19; AudioContext on user gesture |
| Loan management | #5, #8, #15 | Server-side state + overdue; typed transitions; format hooks |
| Categories & Locations | #7, #13, #14 | Combobox with indent; cascade warnings; translations |
| All phases | #14, #15, #16, #21 | Lingui CI check; format hooks grep; route tree up-front; invalidation hooks |

---

## Quick-Reference: "Warning Signs" Checklist

Give this to reviewers. If any are true on a v2.1 PR, escalate:

- [ ] PR imports `idb`, `serwist`, `SyncManager`, `pendingChanges`, or anything matching `*offline*` / `*sync*`
- [ ] Network panel shows `GET /items` or `GET /loans` with no pagination params
- [ ] A form uses more than 3 `useState` calls instead of `react-hook-form`
- [ ] Native `<select>` appears in new UI
- [ ] Any `toLocaleDateString` / `toLocaleTimeString` in new code
- [ ] Barcode scanner page calls `navigate()` to a different route mid-scan flow
- [ ] `<input type="file">` with no `accept`, no size check, no resize step
- [ ] `queryClient` used directly in a component (should be in a `useXxxMutation` hook)
- [ ] New strings not wrapped in `<Trans>` / `t` tagged template
- [ ] Delete button on category/location without dependent-count confirmation

---

## Sources

- PROJECT.md Current Milestone v2.1, Key Decisions, Constraints, Tech Debt — project ground truth (HIGH)
- `frontend2/src/components/retro/` directory listing — current primitive inventory (HIGH)
- v1.3 shipped patterns for barcode/camera (PROJECT.md v1.3) — precedent for pitfalls #3, #18, #19, #20 (HIGH)
- v1.9 Quick Capture lessons, esp. stale-closure tech debt — pitfall #4 (HIGH)
- React Router v7, TanStack Query, react-hook-form, zod common guidance — library-ecosystem (MEDIUM, training data, verify versions at implementation time)
- `@yudiel/react-qr-scanner` React 19 compat — LOW, must verify at phase start (pitfall #10)
